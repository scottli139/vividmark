//! 系统原生菜单（macOS 菜单栏 / Windows-Linux 窗口菜单条）
//!
//! 事件流：菜单点击 → lib.rs on_menu_event → emit("native-menu-event", id)
//! → 前端 src/lib/nativeMenu.ts 分发。
//! 注意：带 accelerator 的键（Cmd+O/S/N/B/I/K/1~6 等）在桌面端被 OS 拦截，webview
//! 收不到 keydown，因此桌面端快捷键完全由菜单事件驱动；浏览器 dev 环境
//! 无原生菜单，仍走 useKeyboardShortcuts / CM keymap / Milkdown keymap。
//!
//! 结构对齐 Typora：App / 文件 / 编辑 / 段落 / 格式 / 视图 / 窗口。
//! format:* 与 insert:* 的 id 与编辑器右键菜单（src/lib/contextMenu.ts）同源，
//! 前端统一转发 editor-format / editor-insert 事件总线。

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
    open_folder: &'static str,
    reveal_finder: &'static str,
    reveal_manager: &'static str,
    save: &'static str,
    save_as: &'static str,
    export_pdf: &'static str,
    export_site: &'static str,
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    paste_plain: &'static str,
    find: &'static str,
    paragraph: &'static str,
    headings: [&'static str; 6],
    normal_text: &'static str,
    quote: &'static str,
    bullet_list: &'static str,
    ordered_list: &'static str,
    task_list: &'static str,
    code_block: &'static str,
    horizontal_rule: &'static str,
    table: &'static str,
    image: &'static str,
    admonition: &'static str,
    format: &'static str,
    bold: &'static str,
    italic: &'static str,
    strikethrough: &'static str,
    inline_code: &'static str,
    link: &'static str,
    view: &'static str,
    sidebar: &'static str,
    sidebar_files: &'static str,
    sidebar_outline: &'static str,
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
    // 仅 macOS 文件菜单使用
    #[allow(dead_code)]
    close_window: &'static str,
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
            open_folder: "打开文件夹…",
            reveal_finder: "在 Finder 中显示",
            reveal_manager: "在文件管理器中显示",
            save: "保存",
            save_as: "另存为…",
            export_pdf: "导出 PDF…",
            export_site: "导出为网站…",
            edit: "编辑",
            undo: "撤销",
            redo: "重做",
            paste_plain: "粘贴为纯文本",
            find: "查找…",
            paragraph: "段落",
            headings: ["标题 1", "标题 2", "标题 3", "标题 4", "标题 5", "标题 6"],
            normal_text: "正文",
            quote: "引用",
            bullet_list: "无序列表",
            ordered_list: "有序列表",
            task_list: "任务列表",
            code_block: "代码块",
            horizontal_rule: "水平分割线",
            table: "表格…",
            image: "图像…",
            admonition: "提示框…",
            format: "格式",
            bold: "加粗",
            italic: "斜体",
            strikethrough: "删除线",
            inline_code: "行内代码",
            link: "链接",
            view: "视图",
            sidebar: "侧边栏",
            sidebar_files: "文件",
            sidebar_outline: "大纲",
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
            close_window: "关闭窗口",
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
            open_folder: "Open Folder…",
            reveal_finder: "Show in Finder",
            reveal_manager: "Show in File Manager",
            save: "Save",
            save_as: "Save As…",
            export_pdf: "Export PDF…",
            export_site: "Export as Site…",
            edit: "Edit",
            undo: "Undo",
            redo: "Redo",
            paste_plain: "Paste as Plain Text",
            find: "Find…",
            paragraph: "Paragraph",
            headings: [
                "Heading 1",
                "Heading 2",
                "Heading 3",
                "Heading 4",
                "Heading 5",
                "Heading 6",
            ],
            normal_text: "Normal Text",
            quote: "Quote",
            bullet_list: "Bullet List",
            ordered_list: "Ordered List",
            task_list: "Task List",
            code_block: "Code Block",
            horizontal_rule: "Horizontal Rule",
            table: "Table…",
            image: "Image…",
            admonition: "Admonition…",
            format: "Format",
            bold: "Bold",
            italic: "Italic",
            strikethrough: "Strikethrough",
            inline_code: "Inline Code",
            link: "Link",
            view: "View",
            sidebar: "Sidebar",
            sidebar_files: "Files",
            sidebar_outline: "Outline",
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
            close_window: "Close Window",
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
    let clear = MenuItem::with_id(
        app,
        "clear-recent",
        l.clear_recent,
        !recent_files.is_empty(),
        None::<&str>,
    )?;

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
    let mut refs: Vec<&dyn IsMenuItem<R>> = items.iter().map(|i| i as &dyn IsMenuItem<R>).collect();
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
            &CheckMenuItem::with_id(
                app,
                "theme-system",
                l.theme_system,
                true,
                true,
                None::<&str>,
            )?,
        ],
    )
}

/// File 菜单主体（两平台共用；macOS 末尾是关闭窗口，Win/Linux 由调用方接 Settings/Exit）
fn file_items<R: Runtime>(
    app: &AppHandle<R>,
    l: &Labels,
    recent: &Submenu<R>,
) -> tauri::Result<Vec<Box<dyn IsMenuItem<R>>>> {
    let reveal_label = if cfg!(target_os = "macos") {
        l.reveal_finder
    } else {
        l.reveal_manager
    };
    Ok(vec![
        Box::new(MenuItem::with_id(
            app,
            "file-new",
            l.new,
            true,
            Some("CmdOrCtrl+N"),
        )?),
        Box::new(MenuItem::with_id(
            app,
            "file-open",
            l.open,
            true,
            Some("CmdOrCtrl+O"),
        )?),
        Box::new(recent.clone()),
        Box::new(PredefinedMenuItem::separator(app)?),
        Box::new(MenuItem::with_id(
            app,
            "file-open-folder",
            l.open_folder,
            true,
            Some("CmdOrCtrl+Shift+O"),
        )?),
        // 初始禁用：无打开文件时不可用；前端按 filePath 同步 enabled
        Box::new(MenuItem::with_id(
            app,
            "file-reveal",
            reveal_label,
            false,
            None::<&str>,
        )?),
        Box::new(PredefinedMenuItem::separator(app)?),
        Box::new(MenuItem::with_id(
            app,
            "file-save",
            l.save,
            true,
            Some("CmdOrCtrl+S"),
        )?),
        Box::new(MenuItem::with_id(
            app,
            "file-save-as",
            l.save_as,
            true,
            Some("CmdOrCtrl+Shift+S"),
        )?),
        Box::new(PredefinedMenuItem::separator(app)?),
        Box::new(MenuItem::with_id(
            app,
            "export-pdf",
            l.export_pdf,
            true,
            Some("CmdOrCtrl+P"),
        )?),
        // 初始禁用：无打开文件夹时不可用；前端按 openedFolder 同步 enabled
        Box::new(MenuItem::with_id(
            app,
            "export-site",
            l.export_site,
            false,
            None::<&str>,
        )?),
    ])
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
            &MenuItem::with_id(
                app,
                "edit-paste-plain",
                l.paste_plain,
                true,
                Some("CmdOrCtrl+Shift+V"),
            )?,
            &PredefinedMenuItem::select_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "edit-find", l.find, true, Some("CmdOrCtrl+F"))?,
        ],
    )
}

/// Paragraph 菜单（Typora 结构）：标题 1-6 / 正文 / 引用与列表 / 代码块 / 插入组。
/// format:* id 与右键菜单同源；⌘1~6/⌘0 桌面端由菜单事件驱动（webview 内同键不再触发）。
fn paragraph_submenu<R: Runtime>(app: &AppHandle<R>, l: &Labels) -> tauri::Result<Submenu<R>> {
    let h = &l.headings;
    Submenu::with_items(
        app,
        l.paragraph,
        true,
        &[
            &MenuItem::with_id(app, "format:h1", h[0], true, Some("CmdOrCtrl+1"))?,
            &MenuItem::with_id(app, "format:h2", h[1], true, Some("CmdOrCtrl+2"))?,
            &MenuItem::with_id(app, "format:h3", h[2], true, Some("CmdOrCtrl+3"))?,
            &MenuItem::with_id(app, "format:h4", h[3], true, Some("CmdOrCtrl+4"))?,
            &MenuItem::with_id(app, "format:h5", h[4], true, Some("CmdOrCtrl+5"))?,
            &MenuItem::with_id(app, "format:h6", h[5], true, Some("CmdOrCtrl+6"))?,
            &MenuItem::with_id(
                app,
                "format:paragraph",
                l.normal_text,
                true,
                Some("CmdOrCtrl+0"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "format:quote", l.quote, true, Some("CmdOrCtrl+Alt+Q"))?,
            &MenuItem::with_id(
                app,
                "format:list",
                l.bullet_list,
                true,
                Some("CmdOrCtrl+Alt+U"),
            )?,
            &MenuItem::with_id(
                app,
                "format:ol",
                l.ordered_list,
                true,
                Some("CmdOrCtrl+Alt+O"),
            )?,
            &MenuItem::with_id(
                app,
                "format:tasklist",
                l.task_list,
                true,
                Some("CmdOrCtrl+Alt+X"),
            )?,
            &MenuItem::with_id(
                app,
                "format:codeblock",
                l.code_block,
                true,
                Some("CmdOrCtrl+Alt+C"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "insert:hr", l.horizontal_rule, true, None::<&str>)?,
            &MenuItem::with_id(app, "insert:table", l.table, true, None::<&str>)?,
            &MenuItem::with_id(app, "insert:image", l.image, true, None::<&str>)?,
            &MenuItem::with_id(app, "insert:admonition", l.admonition, true, None::<&str>)?,
        ],
    )
}

/// Format 菜单（Typora 结构）：行内格式 + 链接 + 图像
fn format_submenu<R: Runtime>(app: &AppHandle<R>, l: &Labels) -> tauri::Result<Submenu<R>> {
    Submenu::with_items(
        app,
        l.format,
        true,
        &[
            &MenuItem::with_id(app, "format:bold", l.bold, true, Some("CmdOrCtrl+B"))?,
            &MenuItem::with_id(app, "format:italic", l.italic, true, Some("CmdOrCtrl+I"))?,
            &MenuItem::with_id(app, "format:strike", l.strikethrough, true, None::<&str>)?,
            &MenuItem::with_id(app, "format:code", l.inline_code, true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "format:link", l.link, true, Some("CmdOrCtrl+K"))?,
            &MenuItem::with_id(app, "insert:image", l.image, true, None::<&str>)?,
        ],
    )
}

/// 侧边栏 tab 快捷键：macOS 用 ⌃⌘1/2（Typora 同款），Win/Linux 不绑定（⌃⌘ 无对应）
fn sidebar_tab_accel(key: &'static str) -> Option<&'static str> {
    if cfg!(target_os = "macos") {
        Some(key)
    } else {
        None
    }
}

/// View 菜单：侧栏 / 侧栏 tab（check）/ 视图模式（check）/ 缩放 / 主题 / 全屏。
/// （⌘/ 源码⇄所见即所得切换刻意不入菜单——与四个模式 check 项并列易混淆；
/// 桌面端该键无 accelerator 占用，keydown 直达 webview 由 useKeyboardShortcuts 处理）
/// 视图模式加速器用 CmdOrCtrl+Alt+1~4；实际大小用 ⇧⌘0（⌘0 让位给段落菜单的「正文」）
fn view_submenu<R: Runtime>(app: &AppHandle<R>, l: &Labels) -> tauri::Result<Submenu<R>> {
    let theme = theme_submenu(app, l)?;
    Submenu::with_items(
        app,
        l.view,
        true,
        &[
            &MenuItem::with_id(
                app,
                "view-sidebar",
                l.sidebar,
                true,
                Some("CmdOrCtrl+Shift+B"),
            )?,
            &CheckMenuItem::with_id(
                app,
                "view-sidebar-files",
                l.sidebar_files,
                true,
                false,
                sidebar_tab_accel("Ctrl+Cmd+1"),
            )?,
            &CheckMenuItem::with_id(
                app,
                "view-sidebar-outline",
                l.sidebar_outline,
                true,
                true,
                sidebar_tab_accel("Ctrl+Cmd+2"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &CheckMenuItem::with_id(
                app,
                "view-mode-wysiwyg",
                l.mode_wysiwyg,
                true,
                true,
                Some("CmdOrCtrl+Alt+1"),
            )?,
            &CheckMenuItem::with_id(
                app,
                "view-mode-source",
                l.mode_source,
                true,
                false,
                Some("CmdOrCtrl+Alt+2"),
            )?,
            &CheckMenuItem::with_id(
                app,
                "view-mode-split",
                l.mode_split,
                true,
                false,
                Some("CmdOrCtrl+Alt+3"),
            )?,
            &CheckMenuItem::with_id(
                app,
                "view-mode-preview",
                l.mode_preview,
                true,
                false,
                Some("CmdOrCtrl+Alt+4"),
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "zoom-in", l.zoom_in, true, Some("CmdOrCtrl+="))?,
            &MenuItem::with_id(app, "zoom-out", l.zoom_out, true, Some("CmdOrCtrl+-"))?,
            &MenuItem::with_id(
                app,
                "zoom-reset",
                l.zoom_reset,
                true,
                Some("CmdOrCtrl+Shift+0"),
            )?,
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
    let paragraph = paragraph_submenu(app, &l)?;
    let format = format_submenu(app, &l)?;
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
        let file_items = file_items(app, &l, &recent)?;
        let mut file_refs: Vec<&dyn IsMenuItem<R>> =
            file_items.iter().map(|i| i.as_ref()).collect();
        let sep = PredefinedMenuItem::separator(app)?;
        let close = PredefinedMenuItem::close_window(app, Some(l.close_window))?;
        file_refs.push(&sep);
        file_refs.push(&close);
        let file = Submenu::with_items(app, l.file, true, &file_refs)?;
        Menu::with_items(
            app,
            &[&app_menu, &file, &edit, &paragraph, &format, &view, &window],
        )
    }

    #[cfg(not(target_os = "macos"))]
    {
        let file_items = file_items(app, &l, &recent)?;
        let mut file_refs: Vec<&dyn IsMenuItem<R>> =
            file_items.iter().map(|i| i.as_ref()).collect();
        let sep1 = PredefinedMenuItem::separator(app)?;
        let settings = MenuItem::with_id(app, "settings", l.settings, true, Some("CmdOrCtrl+,"))?;
        let sep2 = PredefinedMenuItem::separator(app)?;
        let quit = PredefinedMenuItem::quit(app, Some(l.exit))?;
        file_refs.push(&sep1);
        file_refs.push(&settings);
        file_refs.push(&sep2);
        file_refs.push(&quit);
        let file = Submenu::with_items(app, l.file, true, &file_refs)?;
        let help = Submenu::with_items(
            app,
            l.help,
            true,
            &[&PredefinedMenuItem::about(
                app,
                Some(l.about),
                Some(AboutMetadata::default()),
            )?],
        )?;
        Menu::with_items(
            app,
            &[&file, &edit, &paragraph, &format, &view, &window, &help],
        )
    }
}
