//! macOS Dock 图标右键菜单（applicationDockMenu:）
//!
//! Tauri 2.10 / muda 0.17 / tao 0.34 均无 Dock 菜单 API（只有 set_dock_visibility），
//! 这里用 objc2 在运行时给 tao 的 AppDelegate 类追加 applicationDockMenu: 方法：
//! 系统右键 Dock 图标时回调该方法，返回我们全局缓存的 NSMenu。
//!
//! 菜单点击复用 native-menu-event 通道（file-new / file-open / open-recent:<path> /
//! clear-recent），前端 src/lib/nativeMenu.ts 已有全部分发逻辑，无需新增前端动作。
//!
//! ⚠️ 依赖 tao 内部 AppDelegate 结构（运行时 class_addMethod），tauri/tao 升级时
//! 需回归验证；若 tao 未来自行实现该方法，install 会检测并跳过（不覆盖）。

use std::ffi::c_char;
use std::sync::Mutex;

use objc2::ffi::{class_addMethod, class_respondsToSelector};
use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{define_class, extern_methods, sel, MainThreadMarker};
use objc2_app_kit::{NSApplication, NSMenu, NSMenuItem};
use objc2_foundation::{NSInteger, NSObject, NSString};
use tauri::{AppHandle, Emitter, Wry};

use crate::menu::RecentFilePayload;

/// open-recent 菜单项 tag = 路径在此向量中的索引（每次重建菜单时重置）
static DOCK_RECENT_PATHS: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// 全局缓存的 NSMenu / 目标对象。仅在主线程访问（install / update_dock_menu
/// 都是同步 command，运行在主线程；applicationDockMenu: 由 AppKit 主线程回调）。
struct Shared<T>(T);
unsafe impl<T> Send for Shared<T> {}
unsafe impl<T> Sync for Shared<T> {}

static DOCK_MENU: Mutex<Option<Shared<Retained<NSMenu>>>> = Mutex::new(None);
static DOCK_TARGET: Mutex<Option<Shared<Retained<DockMenuTarget>>>> = Mutex::new(None);
static APP_HANDLE: Mutex<Option<AppHandle<Wry>>> = Mutex::new(None);

/// Dock 菜单点击 → 复用原生菜单事件通道，前端 handleMenuAction 分发
fn emit_menu_event(id: &str) {
    if let Some(app) = APP_HANDLE.lock().unwrap().as_ref() {
        if let Err(e) = app.emit("native-menu-event", id) {
            log::warn!("[dock] Failed to emit menu event {}: {}", id, e);
        }
    }
}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "VividMarkDockMenuTarget"]
    struct DockMenuTarget;

    impl DockMenuTarget {
        #[unsafe(method(newDocument:))]
        fn new_document(&self, _sender: &NSMenuItem) {
            emit_menu_event("file-new");
        }

        #[unsafe(method(openDocument:))]
        fn open_document(&self, _sender: &NSMenuItem) {
            emit_menu_event("file-open");
        }

        #[unsafe(method(openRecent:))]
        fn open_recent(&self, sender: &NSMenuItem) {
            let index = sender.tag() as usize;
            let path = DOCK_RECENT_PATHS.lock().unwrap().get(index).cloned();
            if let Some(path) = path {
                emit_menu_event(&format!("open-recent:{}", path));
            }
        }

        #[unsafe(method(clearRecent:))]
        fn clear_recent(&self, _sender: &NSMenuItem) {
            emit_menu_event("clear-recent");
        }
    }
);

impl DockMenuTarget {
    extern_methods!(
        /// 继承自 NSObject 的 `new`（零 ivar，默认初始化）
        #[unsafe(method(new))]
        fn new() -> Retained<Self>;
    );
}

/// applicationDockMenu: 的 IMP——返回全局缓存菜单（所有权仍由 DOCK_MENU 持有，
/// 系统仅在弹出期间借用）
unsafe extern "C-unwind" fn application_dock_menu(
    _this: *mut AnyObject,
    _sel: Sel,
    _sender: *mut NSApplication,
) -> *mut NSMenu {
    let guard = DOCK_MENU.lock().unwrap();
    match guard.as_ref() {
        Some(menu) => Retained::as_ptr(&menu.0) as *mut NSMenu,
        None => std::ptr::null_mut(),
    }
}

fn make_item(
    mtm: MainThreadMarker,
    target: &AnyObject,
    title: &str,
    action: Sel,
    enabled: bool,
) -> Retained<NSMenuItem> {
    let item = NSMenuItem::new(mtm);
    item.setTitle(&NSString::from_str(title));
    item.setEnabled(enabled);
    unsafe {
        item.setTarget(Some(target));
        item.setAction(Some(action));
    }
    item
}

/// 构建 Dock 菜单：新建 / 打开… / 最近文件（按 tag 索引路径）/ 清空
/// （系统会自动在下方追加 Options / Show All Windows / Hide / Quit）
fn build_dock_menu(
    mtm: MainThreadMarker,
    target: &DockMenuTarget,
    lang: &str,
    recent_files: &[RecentFilePayload],
) -> Retained<NSMenu> {
    let (new_label, open_label, no_recent_label, clear_label) = if lang.starts_with("zh") {
        ("新建", "打开…", "无最近文件", "清空菜单")
    } else {
        ("New", "Open…", "No Recent Files", "Clear Menu")
    };

    let target_obj: &AnyObject = target;
    let menu = NSMenu::new(mtm);

    menu.addItem(&make_item(
        mtm,
        target_obj,
        new_label,
        sel!(newDocument:),
        true,
    ));
    menu.addItem(&make_item(
        mtm,
        target_obj,
        open_label,
        sel!(openDocument:),
        true,
    ));
    menu.addItem(&NSMenuItem::separatorItem(mtm));

    let mut paths = DOCK_RECENT_PATHS.lock().unwrap();
    paths.clear();
    if recent_files.is_empty() {
        let empty = NSMenuItem::new(mtm);
        empty.setTitle(&NSString::from_str(no_recent_label));
        empty.setEnabled(false);
        menu.addItem(&empty);
    } else {
        for (i, f) in recent_files.iter().enumerate() {
            let item = make_item(mtm, target_obj, &f.name, sel!(openRecent:), true);
            item.setTag(i as NSInteger);
            menu.addItem(&item);
            paths.push(f.path.clone());
        }
    }
    drop(paths);

    menu.addItem(&NSMenuItem::separatorItem(mtm));
    menu.addItem(&make_item(
        mtm,
        target_obj,
        clear_label,
        sel!(clearRecent:),
        !recent_files.is_empty(),
    ));

    menu
}

/// setup 时安装：给 tao 的 AppDelegate 类运行时追加 applicationDockMenu:
pub fn install(app: &AppHandle<Wry>) {
    let Some(mtm) = MainThreadMarker::new() else {
        log::error!("[dock] install must run on the main thread");
        return;
    };
    *APP_HANDLE.lock().unwrap() = Some(app.clone());

    let ns_app = NSApplication::sharedApplication(mtm);
    let delegate = match ns_app.delegate() {
        Some(d) => d,
        None => {
            log::error!("[dock] No app delegate found, dock menu not installed");
            return;
        }
    };
    let delegate_obj: &AnyObject = delegate.as_ref();

    // 防御：若 tao 未来自带 applicationDockMenu:，不覆盖
    let selector = sel!(applicationDockMenu:);
    let class = delegate_obj.class();
    if unsafe { class_respondsToSelector(class, selector) }.as_bool() {
        log::warn!("[dock] App delegate already implements applicationDockMenu:, skipping");
        return;
    }

    let types = b"@@:@\0"; // 返回 NSMenu*，参数 (self, _cmd, sender)
    let added = unsafe {
        class_addMethod(
            class as *const AnyClass as *mut AnyClass,
            selector,
            std::mem::transmute::<
                unsafe extern "C-unwind" fn(*mut AnyObject, Sel, *mut NSApplication) -> *mut NSMenu,
                Imp,
            >(application_dock_menu),
            types.as_ptr() as *const c_char,
        )
    };
    if !added.as_bool() {
        log::error!("[dock] class_addMethod(applicationDockMenu:) failed");
        return;
    }

    // 初始菜单（空最近文件；前端启动后按持久化状态经 update_dock_menu 重建）
    let target = DockMenuTarget::new();
    let menu = build_dock_menu(mtm, &target, "en", &[]);
    *DOCK_TARGET.lock().unwrap() = Some(Shared(target));
    *DOCK_MENU.lock().unwrap() = Some(Shared(menu));

    log::info!("[dock] Dock menu installed");
}

/// 前端最近文件/语言变化时重建 Dock 菜单（与 rebuild_menu 同订阅点）
#[tauri::command]
pub fn update_dock_menu(lang: String, recent_files: Vec<RecentFilePayload>) -> Result<(), String> {
    let mtm = MainThreadMarker::new().ok_or("update_dock_menu must run on the main thread")?;
    let guard = DOCK_TARGET.lock().unwrap();
    if let Some(target) = guard.as_ref() {
        let menu = build_dock_menu(mtm, &target.0, &lang, &recent_files);
        *DOCK_MENU.lock().unwrap() = Some(Shared(menu));
        log::debug!(
            "[dock] Dock menu rebuilt (lang={}, recent={})",
            lang,
            recent_files.len()
        );
    }
    Ok(())
}
