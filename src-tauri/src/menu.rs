//! 系统原生菜单（macOS 菜单栏 / Windows-Linux 窗口菜单条）
//!
//! 事件流：菜单点击 → lib.rs on_menu_event → emit("native-menu-event", id)
//! → 前端 src/lib/nativeMenu.ts 分发。
//! 注意：带 accelerator 的键（Cmd+O/S/N 等）在桌面端被 OS 拦截，webview
//! 收不到 keydown，因此桌面端快捷键完全由菜单事件驱动；浏览器 dev 环境
//! 无原生菜单，仍走 useKeyboardShortcuts。

use tauri::{
    menu::{AboutMetadata, CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Runtime,
};

/// 前端 recentFiles 条目（只需名称与路径）
#[derive(Debug, Clone, serde::Deserialize)]
pub struct RecentFilePayload {
    pub name: String,
    pub path: String,
}

/// 菜单文案（跟随应用内语言设置；predefined 项由系统语言渲染）
struct Labels {
    about: &'static str,
    settings: &'static str,
    file: &'static str,
    new: &'static str,
    open: &'static str,
    open_recent: &'static str,
    no_recent: &'static str,
    clear_recent: &'static str,
    save: &'static str,
    save_as: &'static str,
    export_pdf: &'static str,
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    find: &'static str,
    view: &'static str,
    sidebar: &'static str,
    mode_wysiwyg: &'static str,
    mode_source: &'static str,
    mode_split: &'static str,
    mode_preview: &'static str,
    zoom_in: &'static str,
    zoom_out: &'static str,
    zoom_reset: &'static str,
    theme: &'static str,
    theme_light: &'static str,
    theme_dark: &'static str,
    theme_system: &'static str,
    window: &'static str,
    // 仅 Windows/Linux 布局使用
    #[allow(dead_code)]
    help: &'static str,
    #[allow(dead_code)]
    exit: &'static str,
}

fn labels(lang: &str) -> Labels {
    if lang.starts_with("zh") {
        Labels {
            about: "关于 VividMark",
            settings: "设置…",
            file: "文件",
            new: "新建",
            open: "打开…",
            open_recent: "最近打开",
            no_recent: "无最近文件",
            clear_recent: "清空菜单",
            save: "保存",
            save_as: "另存为…",
            export_pdf: "导出 PDF…",
            edit: "编辑",
            undo: "撤销",
            redo: "重做",
            find: "查找…",
            view: "视图",
            sidebar: "侧边栏",
            mode_wysiwyg: "所见即所得",
            mode_source: "源码",
            mode_split: "分屏",
            mode_preview: "预览",
            zoom_in: "放大",
            zoom_out: "缩小",
            zoom_reset: "实际大小",
            theme: "主题",
            theme_light: "浅色",
            theme_dark: "深色",
            theme_system: "跟随系统",
            window: "窗口",
            help: "帮助",
            exit: "退出",
        }
    } else {
        Labels {
            about: "About VividMark",
            settings: "Settings…",
            file: "File",
            new: "New",
            open: "Open…",
            open_recent: "Open Recent",
            no_recent: "No Recent Files",
            clear_recent: "Clear Menu",
            save: "Save",
            save_as: "Save As…",
            export_pdf: "Export PDF…",
            edit: "Edit",
            undo: "Undo",
            redo: "Redo",
            find: "Find…",
            view: "View",
            sidebar: "Sidebar",
            mode_wysiwyg: "WYSIWYG",
            mode_source: "Source",
            mode_split: "Split",
            mode_preview: "Preview",
            zoom_in: "Zoom In",
            zoom_out: "Zoom Out",
            zoom_reset: "Actual Size",
            theme: "Theme",
            theme_light: "Light",
            theme_dark: "Dark",
            theme_system: "System",
            window: "Window",
            help: "Help",
            exit: "Exit",
        }
    }
}

/// Open Recent 子菜单：动态生成，空列表时显示禁用占位；末尾固定「清空」
fn recent_submenu<R: Runtime>(
    app: &AppHandle<R>,
    l: &Labels,
    recent_files: &[RecentFilePayload],
) -> tauri::Result<Submenu<R>> {
    let sep = PredefinedMenuItem::separator(app)?;
    let clear = MenuItem::with_id(app, "clear-recent", l.clear_recent, !recent_files.is_empty(), None::<&str>)?;

    if recent_files.is_empty() {
        let empty = MenuItem::with_id(app, "open-recent-empty", l.no_recent, false, None::<&str>)?;
        return Submenu::with_items(app, l.open_recent, true, &[&empty, &sep, &clear]);
    }

    let mut items: Vec<MenuItem<R>> = Vec::with_capacity(recent_files.len());
    for f in recent_files {
        items.push(MenuItem::with_id(
            app,
            format!("open-recent:{}", f.path),
            &f.name,
            true,
            None::<&str>,
        )?);
    }
    let mut refs: Vec<&dyn IsMenuItem<R>> =
        items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();
    refs.push(&sep);
    refs.push(&clear);
    Submenu::with_items(app, l.open_recent, true, &refs)
}

/// Theme 子菜单（三态 check 项，初始 system，前端启动后同步真实状态）
fn theme_submenu<R: Runtime>(app: &AppHandle<R>, l: &Labels) -> tauri::Result<Submenu<R>> {
    Submenu::with_items(
        app,
        l.theme,
        true,
        &[
            &CheckMenuItem::with_id(app, "theme-light", l.theme_light, true, false, None::<&str>)?,
            &CheckMenuItem::with_id(app, "theme-dark", l.theme_dark, true, false, None::<&str>)?,
            &CheckMenuItem::with_id(app, "theme-system", l.theme_system, true, true, None::<&str>)?,
        ],
    )
}

/// Edit 菜单：Undo/Redo 用自定义项（转发到 CM6/Milkdown 自带 history，
/// 系统级 undo 会绕过编辑器历史栈）；Cut/Copy/Paste/Select All 用 predefined
fn edit_submenu<R: Runtime>(app: &AppHandle<R>, l: &Labels) -> tauri::Result<Submenu<R>> {
    Submenu::with_items(
        app,
        l.edit,
        true,
        &[
            &MenuItem::with_id(app, "edit-undo", l.undo, true, Some("CmdOrCtrl+Z"))?,
            &MenuItem::with_id(app, "edit-redo", l.redo, true, Some("CmdOrCtrl+Shift+Z"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "edit-find", l.find, true, Some("CmdOrCtrl+F"))?,
        ],
    )
}

/// View 菜单：侧栏 / 视图模式（check）/ 缩放 / 主题 / 全屏。
/// 视图模式加速器用 CmdOrCtrl+Alt+1~4，避开 CM 的 Cmd+1~3 标题快捷键
fn view_submenu<R: Runtime>(app: &AppHandle<R>, l: &Labels) -> tauri::Result<Submenu<R>> {
    let theme = theme_submenu(app, l)?;
    Submenu::with_items(
        app,
        l.view,
        true,
        &[
            &MenuItem::with_id(app, "view-sidebar", l.sidebar, true, Some("CmdOrCtrl+Shift+B"))?,
            &PredefinedMenuItem::separator(app)?,
            &CheckMenuItem::with_id(app, "view-mode-wysiwyg", l.mode_wysiwyg, true, true, Some("CmdOrCtrl+Alt+1"))?,
            &CheckMenuItem::with_id(app, "view-mode-source", l.mode_source, true, false, Some("CmdOrCtrl+Alt+2"))?,
            &CheckMenuItem::with_id(app, "view-mode-split", l.mode_split, true, false, Some("CmdOrCtrl+Alt+3"))?,
            &CheckMenuItem::with_id(app, "view-mode-preview", l.mode_preview, true, false, Some("CmdOrCtrl+Alt+4"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "zoom-in", l.zoom_in, true, Some("CmdOrCtrl+="))?,
            &MenuItem::with_id(app, "zoom-out", l.zoom_out, true, Some("CmdOrCtrl+-"))?,
            &MenuItem::with_id(app, "zoom-reset", l.zoom_reset, true, Some("CmdOrCtrl+0"))?,
            &PredefinedMenuItem::separator(app)?,
            &theme,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )
}

/// 构建完整菜单。macOS 带 App 菜单（About/Settings/Services/Hide/Quit）；
/// Windows/Linux 将 Settings 与 Exit 放入 File，About 放入 Help
pub fn build_menu<R: Runtime>(
    app: &AppHandle<R>,
    lang: &str,
    recent_files: &[RecentFilePayload],
) -> tauri::Result<Menu<R>> {
    let l = labels(lang);
    let recent = recent_submenu(app, &l, recent_files)?;
    let edit = edit_submenu(app, &l)?;
    let view = view_submenu(app, &l)?;
    let window = Submenu::with_items(
        app,
        l.window,
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
        ],
    )?;

    #[cfg(target_os = "macos")]
    {
        let app_menu = Submenu::with_items(
            app,
            "VividMark",
            true,
            &[
                &PredefinedMenuItem::about(app, Some(l.about), Some(AboutMetadata::default()))?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "settings", l.settings, true, Some("CmdOrCtrl+,"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::services(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?;
        let file = Submenu::with_items(
            app,
            l.file,
            true,
            &[
                &MenuItem::with_id(app, "file-new", l.new, true, Some("CmdOrCtrl+N"))?,
                &MenuItem::with_id(app, "file-open", l.open, true, Some("CmdOrCtrl+O"))?,
                &recent,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "file-save", l.save, true, Some("CmdOrCtrl+S"))?,
                &MenuItem::with_id(app, "file-save-as", l.save_as, true, Some("CmdOrCtrl+Shift+S"))?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "export-pdf", l.export_pdf, true, Some("CmdOrCtrl+P"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::close_window(app, None)?,
            ],
        )?;
        Menu::with_items(app, &[&app_menu, &file, &edit, &view, &window])
    }

    #[cfg(not(target_os = "macos"))]
    {
        let file = Submenu::with_items(
            app,
            l.file,
            true,
            &[
                &MenuItem::with_id(app, "file-new", l.new, true, Some("CmdOrCtrl+N"))?,
                &MenuItem::with_id(app, "file-open", l.open, true, Some("CmdOrCtrl+O"))?,
                &recent,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "file-save", l.save, true, Some("CmdOrCtrl+S"))?,
                &MenuItem::with_id(app, "file-save-as", l.save_as, true, Some("CmdOrCtrl+Shift+S"))?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "export-pdf", l.export_pdf, true, Some("CmdOrCtrl+P"))?,
                &PredefinedMenuItem::separator(app)?,
                &MenuItem::with_id(app, "settings", l.settings, true, Some("CmdOrCtrl+,"))?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, Some(l.exit))?,
            ],
        )?;
        let help = Submenu::with_items(
            app,
            l.help,
            true,
            &[&PredefinedMenuItem::about(app, Some(l.about), Some(AboutMetadata::default()))?],
        )?;
        Menu::with_items(app, &[&file, &edit, &view, &window, &help])
    }
}
