//! 文件变更监控：监听当前文档在磁盘上的外部修改/删除，按窗口定向推送事件
//!
//! - 每窗口最多一个 watcher（Typora 式 SDI 单文档），label → WatchEntry 注册表
//! - notify 推荐后端（macOS = FSEvents，路径级，原子写 rename 交换 inode 后仍持续）
//! - 监听父目录（NonRecursive）再按目标路径过滤事件——比直接监听文件更稳，
//!   原子保存（write tmp + rename swap）场景不会丢监视
//! - 防抖：事件进 mpsc，专属线程 300ms 静默期后按 fs::metadata 重新分类
//!   changed / removed（不依赖 notify 事件类型，rename-away 等边界自然归 removed）
//! - 自身保存的回声抑制在前端（lastKnownContent 比对），本模块只做忠实上报

use notify::{RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{Emitter, Manager, WebviewWindow};

/// 防抖静默期：编辑器写盘常是多步突发，等安静后再分类上报
const DEBOUNCE: Duration = Duration::from_millis(300);

pub const FILE_WATCH_EVENT: &str = "file-watch-event";

#[derive(Clone, Serialize)]
struct FileWatchPayload {
    path: String,
    /// "changed" | "removed"
    kind: &'static str,
}

/// watcher 本体仅作保活持有（drop 即停）；事件发送端随 drop 断开，防抖线程自行退出
struct WatchEntry {
    _watcher: notify::RecommendedWatcher,
}

static WATCHERS: OnceLock<Mutex<HashMap<String, WatchEntry>>> = OnceLock::new();

fn watchers() -> &'static Mutex<HashMap<String, WatchEntry>> {
    WATCHERS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 移除指定窗口的 watcher（窗口销毁 / 换文件 / 关闭文档时调用）
pub fn remove_watcher(label: &str) {
    if watchers().lock().unwrap().remove(label).is_some() {
        log::info!("[file-watch] Stopped watcher for window {}", label);
    }
}

/// 监听指定文件的外部变更；同窗口重复调用先停旧 watcher
#[tauri::command]
pub fn watch_file(window: WebviewWindow, path: String) -> Result<(), String> {
    let label = window.label().to_string();
    remove_watcher(&label);

    let path_buf = PathBuf::from(&path);
    // 事件路径可能与传入路径形态不同（symlink/大小写），两份都留着比对
    let canonical = path_buf.canonicalize().unwrap_or_else(|_| path_buf.clone());

    // 监听父目录而非文件本身：FSEvents 只支持目录级，且原子写 rename 交换更稳
    let watch_target = path_buf
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| path_buf.clone());

    let (tx, rx) = mpsc::channel::<()>();
    let filter_path = path_buf.clone();
    let filter_canonical = canonical.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        if event
            .paths
            .iter()
            .any(|p| p == &filter_path || p == &filter_canonical)
        {
            let _ = tx.send(());
        }
    })
    .map_err(|e| format!("failed to create watcher: {}", e))?;

    watcher
        .watch(&watch_target, RecursiveMode::NonRecursive)
        .map_err(|e| format!("failed to watch {}: {}", watch_target.display(), e))?;

    let app = window.app_handle().clone();
    let report_path = path_buf.to_string_lossy().into_owned();
    let thread_label = label.clone();
    std::thread::spawn(move || {
        loop {
            // watcher drop → 发送端断开 → recv 出错退出
            if rx.recv().is_err() {
                break;
            }
            // 防抖：持续 drain 直到静默期满
            while rx.recv_timeout(DEBOUNCE).is_ok() {}
            let kind = match std::fs::metadata(&path_buf) {
                Ok(_) => "changed",
                Err(_) => "removed",
            };
            let payload = FileWatchPayload {
                path: report_path.clone(),
                kind,
            };
            if let Err(e) = app.emit_to(&thread_label, FILE_WATCH_EVENT, payload) {
                log::warn!("[file-watch] emit to {} failed: {}", thread_label, e);
                break;
            }
        }
    });

    watchers()
        .lock()
        .unwrap()
        .insert(label.clone(), WatchEntry { _watcher: watcher });
    log::info!("[file-watch] Watching {} for window {}", path, label);
    Ok(())
}

/// 停止监听当前窗口的文件（关闭文档/新建时调用）
#[tauri::command]
pub fn unwatch_file(window: WebviewWindow) {
    remove_watcher(window.label());
}
