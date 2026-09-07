//! 多窗口（Typora 式 SDI）窗口路由与注册表
//!
//! 每个文档窗口是独立 webview/JS 上下文，前端单文档 store 无需改动；
//! 本模块负责把「打开文件」与「菜单事件」路由到正确的窗口：
//!
//! - WINDOW_STATES：label → 文档状态（前端 filePath/isDirty 变化时经
//!   report_window_state 上报），是「已打开文件 → 窗口」的唯一事实来源
//! - LAST_FOCUSED：最近焦点窗口（on_window_event Focused/Destroyed 维护），
//!   菜单/Dock 事件定向 emit 给它（tauri 的菜单事件不携带窗口来源，
//!   macOS 菜单栏点击不改变 key window、Windows 点击菜单必先聚焦，启发式两端成立）
//! - STARTUP_OPEN_FILES：label → 启动待打开路径（新窗口前端就绪前事件必丢，
//!   前端 initOpenWith 经 take_startup_open_files 按 label 取走——冷启动积压
//!   模式与文件关联一致）
//!
//! 打开路径策略（Typora 对齐）：已在某窗口打开 → 聚焦；source/焦点窗口是干净
//! 空文档 → 复用；否则新建窗口。

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::pdf::PDF_WINDOW_LABEL;

/// 窗口文档状态（前端上报）
#[derive(Debug, Clone, Default)]
pub struct WindowDocState {
    pub path: Option<String>,
    pub dirty: bool,
}

// HashMap::new 非 const fn，且 MSRV 1.77 无 LazyLock——用 OnceLock 惰性初始化
static WINDOW_STATES: OnceLock<Mutex<HashMap<String, WindowDocState>>> = OnceLock::new();
static STARTUP_OPEN_FILES: OnceLock<Mutex<HashMap<String, Vec<String>>>> = OnceLock::new();
static LAST_FOCUSED: Mutex<Option<String>> = Mutex::new(None);
static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);

fn window_states() -> &'static Mutex<HashMap<String, WindowDocState>> {
    WINDOW_STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn startup_open_files() -> &'static Mutex<HashMap<String, Vec<String>>> {
    STARTUP_OPEN_FILES.get_or_init(|| Mutex::new(HashMap::new()))
}

// ==================== 窗口事件维护 ====================

pub fn set_last_focused(label: &str) {
    // PDF 导出隐藏窗口不参与路由（visible(false) 正常不会获焦，防御性排除）
    if label == PDF_WINDOW_LABEL {
        return;
    }
    *LAST_FOCUSED.lock().unwrap() = Some(label.to_string());
}

pub fn remove_window_state(label: &str) {
    window_states().lock().unwrap().remove(label);
    let mut last = LAST_FOCUSED.lock().unwrap();
    if last.as_deref() == Some(label) {
        *last = None;
    }
}

// ==================== 定向事件 ====================

/// 菜单/Dock 事件定向到最近焦点窗口；无记录（启动期/窗口全关）退化为广播
/// （单窗口行为与改造前一致）
pub fn emit_to_focused(app: &AppHandle, event: &str, payload: &str) {
    let target = LAST_FOCUSED
        .lock()
        .unwrap()
        .clone()
        .and_then(|label| app.get_webview_window(&label));
    let result = match target {
        Some(window) => window.emit(event, payload),
        None => app.emit(event, payload),
    };
    if let Err(e) = result {
        log::warn!("[window-router] Failed to emit {} : {}", event, e);
    }
}

// ==================== 新窗口创建 ====================

static MAIN_THREAD_ID: OnceLock<std::thread::ThreadId> = OnceLock::new();

/// 在 setup（主线程）记录主线程 id：macOS/Linux 建窗必须在主线程，
/// create_document_window 据此决定直接建还是 run_on_main_thread 派发
pub fn mark_main_thread() {
    let _ = MAIN_THREAD_ID.set(std::thread::current().id());
}

/// 窗口构建器（选项与 tauri.conf.json 的主窗口配置保持一致；macOS 融合标题栏
/// 三项按平台门控）。builder 生命周期绑定 app 引用，故 Windows 的 with_webview
/// 路径必须在闭包内重新构造（builder 无法 'static 化移入闭包）。
fn base_builder<'a>(app: &'a AppHandle, label: &str) -> WebviewWindowBuilder<'a, tauri::Wry, AppHandle> {
    #[allow(unused_mut)]
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("VividMark")
        .inner_size(1200.0, 800.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .center();

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .traffic_light_position(tauri::Position::Logical(tauri::LogicalPosition::new(
                12.0, 25.5,
            )));
    }

    // Linux：与主窗口一致，建窗时即无边框（前端自绘标题栏，见 lib.rs setup）。
    // Windows 不这么干——见 build_document_window 的 set_decorations 注释。
    #[cfg(target_os = "linux")]
    {
        builder = builder.decorations(false);
    }

    builder
}

/// 实际建窗。Windows 调用方必须在**非主线程**（async 命令的 runtime worker）：
/// 主线程事件循环运转后，主线程上 build() 会自死锁（WebView2 创建的完成回调
/// 要由事件循环处理，而它被 build() 自身阻塞——wry#583 家族，0.9.0 实测
/// 「新建窗口后 app 假死、窗口无法关闭」）。worker 线程上 wry 的 wait_with_pump
/// 能正常收到完成回调（Tauri 文档要求建窗命令必须 async 的原因）。
/// macOS/Linux 相反：必须在主线程（AppKit/GTK 线程亲和），由调用方保证。
fn build_document_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    let window = base_builder(app, label)
        .build()
        .map_err(|e| format!("failed to create window: {}", e))?;

    // Windows：与主窗口同款「build 成功后 set_decorations(false)」，保持窗口形态一致
    #[cfg(target_os = "windows")]
    if let Err(e) = window.set_decorations(false) {
        log::warn!(
            "[window-router] Failed to disable decorations on {}: {}",
            label,
            e
        );
    }

    Ok(window)
}

/// 创建文档窗口。path 非空时写入启动待打开队列。
///
/// 线程模型（按平台分流，见 build_document_window 注释）：
/// - Windows：直接在当前线程建——**调用链必须是 async 命令（worker 线程）**，
///   见 open_in_new_window / route_open 的 `#[tauri::command(async)]`；
/// - macOS/Linux：必须主线程——调用点已在主线程（macOS RunEvent::Opened）直接建；
///   否则（async 命令的 worker）run_on_main_thread 派发 + channel 等结果，
///   此时主事件循环空闲，无自死锁。
pub fn create_document_window(app: &AppHandle, path: Option<String>) -> Result<String, String> {
    let label = format!("doc-{}", WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed));

    #[cfg(target_os = "windows")]
    build_document_window(app, &label)?;

    #[cfg(not(target_os = "windows"))]
    {
        let on_main_thread = MAIN_THREAD_ID.get() == Some(&std::thread::current().id());
        if on_main_thread {
            build_document_window(app, &label)?;
        } else {
            let (tx, rx) = std::sync::mpsc::channel::<Result<WebviewWindow, String>>();
            let app_handle = app.clone();
            let label_clone = label.clone();
            app.run_on_main_thread(move || {
                let _ = tx.send(build_document_window(&app_handle, &label_clone));
            })
            .map_err(|e| format!("failed to dispatch window creation to main thread: {}", e))?;
            rx.recv()
                .map_err(|_| "window creation channel closed unexpectedly".to_string())??;
        }
    }

    // Linux：新窗口的 app 菜单在建窗时同步挂入（menubar 控件树随之创建），
    // 空图标占位修复需要对每个新窗口重跑
    #[cfg(target_os = "linux")]
    crate::strip_menubar_icon_placeholders(app);

    if let Some(p) = path {
        startup_open_files()
            .lock()
            .unwrap()
            .insert(label.clone(), vec![p]);
    }
    log::info!("[window-router] Created window {}", label);
    Ok(label)
}

// ==================== 打开路径路由 ====================

/// 路由打开路径：已打开 → 聚焦；干净空窗口 → 复用；否则新建。
/// source = 发起方窗口 label（菜单/对话框打开时为本窗口；文件关联为 None）。
pub fn route_open_paths(app: &AppHandle, paths: &[String], source: Option<String>) {
    for path in paths {
        // 1. 已在某窗口打开 → 聚焦（还原最小化）
        let existing = {
            let states = window_states().lock().unwrap();
            states
                .iter()
                .find(|(_, s)| s.path.as_deref() == Some(path.as_str()))
                .map(|(label, _)| label.clone())
        };
        if let Some(label) = existing {
            if let Some(window) = app.get_webview_window(&label) {
                let _ = window.unminimize();
                if let Err(e) = window.set_focus() {
                    log::warn!("[window-router] Failed to focus {}: {}", label, e);
                }
                log::info!(
                    "[window-router] Focused existing window {} for {}",
                    label,
                    path
                );
                continue;
            }
            // 状态残留（窗口已销毁但未清理）——清掉继续走后续策略
            window_states().lock().unwrap().remove(&label);
        }

        // 2. 文件关联冷启动（无 source 且 main 前端未上报）：入队 main 启动队列 +
        //    定向 emit 兜底（前端未就绪时事件丢失，由启动队列补偿）。
        //    main 已关闭时跳过本分支，走新建窗口。
        let main_ready = window_states().lock().unwrap().contains_key("main");
        if source.is_none() && !main_ready && app.get_webview_window("main").is_some() {
            startup_open_files()
                .lock()
                .unwrap()
                .entry("main".to_string())
                .or_default()
                .push(path.clone());
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.emit("file-open-request", vec![path.clone()]);
            }
            continue;
        }

        // 3. 可复用窗口（source 优先，退 LAST_FOCUSED）：无路径且未脏
        let reusable = {
            let candidate = source
                .clone()
                .or_else(|| LAST_FOCUSED.lock().unwrap().clone());
            candidate.and_then(|label| {
                let states = window_states().lock().unwrap();
                match states.get(&label) {
                    Some(s) if s.path.is_none() && !s.dirty => Some(label),
                    _ => None,
                }
            })
        };
        if let Some(label) = reusable {
            if let Some(window) = app.get_webview_window(&label) {
                if let Err(e) = window.emit("file-open-request", vec![path.clone()]) {
                    log::warn!("[window-router] Failed to emit open to {}: {}", label, e);
                }
                let _ = window.unminimize();
                let _ = window.set_focus();
                log::info!("[window-router] Reused window {} for {}", label, path);
                continue;
            }
        }

        // 4. 新建窗口（路径入启动队列，前端就绪后取走）
        //    去重保险：若该路径已在某窗口的启动队列中（如前端 listener 重复
        //    触发导致的 route 竞态），跳过——否则同一文件会建出两个窗口
        let already_pending = startup_open_files()
            .lock()
            .unwrap()
            .values()
            .any(|queued| queued.iter().any(|p| p == path));
        if !already_pending {
            // 新窗口已创建但前端尚未上报状态时，WINDOW_STATES 里也查不到该路径；
            // 再补一道：刚创建的窗口 label 序列检查成本高，pending 检查已覆盖竞态窗口期
            match create_document_window(app, Some(path.clone())) {
                Ok(label) => {
                    log::info!("[window-router] Opened {} in new window {}", path, label)
                }
                Err(e) => log::error!("[window-router] Failed to open {}: {}", path, e),
            }
        } else {
            log::info!(
                "[window-router] {} already pending in a new window, skip duplicate",
                path
            );
        }
    }
}

// ==================== Tauri 命令 ====================

/// 前端上报本窗口文档状态（filePath/isDirty 变化时）
#[tauri::command]
pub fn report_window_state(window: WebviewWindow, path: Option<String>, dirty: bool) {
    window_states()
        .lock()
        .unwrap()
        .insert(window.label().to_string(), WindowDocState { path, dirty });
}

/// 新建文档窗口（file-new：path=None 打开空文档）。
/// **必须 async**：同步命令在主线程执行，主线程 build() 会自死锁
/// （见 build_document_window 注释）；async 后 Tauri 在 runtime worker 线程执行。
#[tauri::command(async)]
pub fn open_in_new_window(app: AppHandle, path: Option<String>) -> Result<String, String> {
    let result = create_document_window(&app, path);
    // 失败时前端只在 webview 控制台可见（release 不可见），落文件日志便于诊断
    if let Err(e) = &result {
        log::error!("[window-router] open_in_new_window failed: {}", e);
    }
    result
}

/// 前端智能打开（file-open 对话框 / 最近文件 / 侧栏最近文件）：经路由决策。
/// async 的原因同 open_in_new_window（新建窗口分支会在 worker 线程建窗）。
#[tauri::command(async)]
pub fn route_open(app: AppHandle, window: WebviewWindow, paths: Vec<String>) {
    route_open_paths(&app, &paths, Some(window.label().to_string()));
}

/// 取走并清空启动待打开队列：label 给定时取对应窗口（initOpenWith 启动路径）；
/// None 时清空全部（file-open-request 热路径的 HMR 清理调用——陈旧条目会在
/// 页面重载后被重复消费，必须清掉）
#[tauri::command]
pub fn take_startup_open_files(label: Option<String>) -> Vec<String> {
    let mut queue = startup_open_files().lock().unwrap();
    match label {
        Some(label) => queue.remove(&label).unwrap_or_default(),
        None => {
            let all: Vec<String> = queue.values().flatten().cloned().collect();
            queue.clear();
            all
        }
    }
}
