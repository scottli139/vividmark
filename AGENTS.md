# VividMark - Agent Guide

Essential information for AI coding agents working on the VividMark project. Keep this file lean — deep implementation notes live in `docs/implementation-notes.md`, task tracking lives in `PLAN.md`.

## Project Overview

**VividMark** is a lightweight Markdown editor built with **Tauri 2.0 + React 19 + TypeScript**, providing a Typora-inspired, distraction-free writing experience.

Key features:

- Four view modes: WYSIWYG (default, Milkdown/ProseMirror) / Source / Split / Preview
- CodeMirror 6 source editor: Markdown highlighting, smart list continuation, find & replace
- Real-time Markdown preview (markdown-it + highlight.js)
- Markdown extensions: admonitions, PlantUML, task lists, tables, math formulas (KaTeX)
- File operations with native dialogs, auto-save (2s idle), drag & drop, recent files
- Multi-window (Typora-style SDI): one window per document with smart open routing (focus / reuse / new window)
- Native menubar (File/Edit/Paragraph/Format/View), macOS Dock menu & file associations (Open With)
- Sidebar with outline navigation and resizable file tree; status bar (word count, cursor, zoom)
- i18n (en / zh-CN), dark mode, 50–200% zoom, PDF export

## Documentation Map

| File                                                               | Content                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `PLAN.md`                                                          | 开发计划与任务进度（唯一的任务看板，不在本文件重复）            |
| `docs/implementation-notes.md`                                     | 实现细节知识库：已知问题、架构要点、发布流程、Git 规范          |
| `docs/session-log.md`                                              | 历史开发日志（Session 记录，自 PLAN.md 归档）                   |
| `docs/REQUIREMENTS.md`                                             | 需求文档                                                        |
| `docs/ux-improvement-plan.md`                                      | Typora 对标体验差距分析与 P0–P3 改进方案                        |
| `docs/wysiwyg-research.md` + `docs/wysiwyg-implementation-plan.md` | WYSIWYG 模式调研与实现计划（自研路线，已被 P2 取代）            |
| `docs/typst-offline-plan.md`                                       | Typst 离线支持计划（⏸️ 暂停中，2026-08-12 评估转向独立产品）    |
| `docs/typst-standalone-editor-plan.md`                             | 独立 Typst 编辑器预研（📋 未立项；与 VividMark 分离的产品方向） |
| `docs/word-export-plan.md`                                         | Word（docx）导出可行性与实现方案（📋 方案待评审，pandoc 路线）  |

## Technology Stack

| Category    | Technology                                                  |
| ----------- | ----------------------------------------------------------- |
| Frontend    | React 19 + TypeScript + Vite 7                              |
| Desktop     | Tauri 2.0 (Rust)                                            |
| Editor      | CodeMirror 6（源码）+ Milkdown 7（所见即所得，ProseMirror） |
| Styling     | Tailwind CSS 4                                              |
| State       | Zustand 5 (persist 用户偏好)                                |
| i18n        | i18next + react-i18next                                     |
| Markdown    | markdown-it + highlight.js + KaTeX                        |
| Unit Tests  | Vitest + React Testing Library                              |
| E2E Tests   | Playwright                                                  |
| Lint/Format | ESLint (flat config) + Prettier                             |

## Project Structure

```
vividmark/
├── src/                      # React frontend
│   ├── components/           # Editor/ Sidebar/ Toolbar/ FileTree/ StatusBar/
│   │                         # Menu/（Dropdown/ContextMenu 菜单原语）Settings/
│   ├── hooks/                # useAutoSave, useFileDragDrop, useKeyboardShortcuts,
│   │                         # useResizable, useDebouncedValue, useContextMenu
│   ├── stores/editorStore.ts # Zustand main store
│   ├── lib/                  # markdown/ markdownEditing textStats plantuml imageSrc
│   │                         # fileOps logger imageUtils theme(主题解析) platform(平台检测)
│   │                         # editorActions(菜单/工具栏共享动作) openWith(文件关联) ...
│   ├── i18n/                 # i18next config + locales/{en,zh-CN}.json
│   ├── styles/globals.css    # Tailwind + theme CSS variables
│   ├── test/                 # Vitest setup + Tauri mocks
│   └── App.tsx / main.tsx
├── src-tauri/                # Rust backend
│   ├── src/lib.rs            # Tauri commands + plugins + RunEvent::Opened
│   ├── src/menu.rs           # 系统菜单栏构建（段落/格式/视图等）
│   ├── src/dock_menu.rs      # macOS Dock 右键菜单（objc2，仅 macOS 编译）
│   ├── capabilities/         # Permissions
│   └── tauri.conf.json
├── e2e/                      # Playwright specs（sourceMode.ts 预置源码模式）
├── scripts/                  # 工具脚本（take-screenshots.mjs 生成 README 截图，需 dev server）
└── docs/                     # Plans, requirements, GitHub Pages site
```

## Commands

```bash
pnpm dev             # Vite dev server only
pnpm tauri:dev       # Full Tauri development (frontend + Rust)
pnpm build           # Frontend production build
pnpm tauri:build     # Full app build

pnpm test            # Vitest watch mode
pnpm test:run        # Unit tests once
pnpm test:coverage   # Coverage report
pnpm test:e2e        # Playwright E2E (uses Vite dev server, not Tauri)

pnpm lint / lint:fix # ESLint
pnpm format / format:check  # Prettier
```

Before committing: `pnpm tsc -b`（**不是** `tsc --noEmit`——根 tsconfig 是 solution 引用式，后者不检查任何文件）→ `pnpm lint` → `pnpm format` → `pnpm test:run`。

## Code Style

- **TS/JS**: 2-space indent, no semicolons, single quotes (double in JSX), 100 char width, ES5 trailing commas (see `.prettierrc`)
- **Rust**: 4-space indent, `snake_case`
- **Naming**: Components `PascalCase.tsx`, hooks `use*.ts`, utilities `camelCase.ts`, tests co-located in `__tests__/` or `*.test.ts`
- **Import order**: React → third-party → `@/` absolute → relative → type imports
- **Styling**: Tailwind utilities; theme colors via CSS variables in `globals.css`; dark mode via `.dark` class; rendered markdown uses `.markdown-body`

## Testing

- **Unit**: Vitest + jsdom, co-located `__tests__/`, v8 coverage
- **E2E**: `e2e/` directory, base URL `http://localhost:5173`
- **Tauri mocks**: use `src/test/mocks/tauri.ts`:

```typescript
import { resetTauriMocks, setupDefaultTauriMocks } from '../test/mocks/tauri'

beforeEach(() => {
  resetTauriMocks()
  setupDefaultTauriMocks()
})
```

- CI runs with strict TS: prefix unused variables with `_` (e.g. `_match`)

## State Management (Zustand)

Main store: `src/stores/editorStore.ts`.

- **Persisted**: `recentFiles`, `themeMode`, `language`, `viewMode`, `zoomLevel`, `showSidebar`, `sidebarTab`, `sidebarWidth`
- **Non-persisted**: `content`, `filePath`/`fileName`, `isDirty`, `isDarkMode`（派生）, `openedFolder`, `cursorLine`/`cursorCol`, `activeHeadingIndex`, `isSettingsOpen`

## Internationalization (i18n)

- Languages: `en` (default), `zh-CN`; locales in `src/i18n/locales/*.json`
- Use `const { t } = useTranslation()` in components; support `{{var}}` interpolation
- Adding a language: create locale JSON, register in `src/i18n/index.ts` (`availableLanguages` + `resources`)
- Language selector uses text labels (`EN` / `中`), not emoji flags (Windows rendering)
- **Doc sync convention**: `README.md` ↔ `README.zh-CN.md`, `docs/index.html` ↔ `docs/index.zh-CN.html` must be updated together

## Tauri Commands (Rust Backend)

Defined in `src-tauri/src/lib.rs`（PDF 导出相关在 `src-tauri/src/pdf.rs`，多窗口路由在 `src-tauri/src/window_router.rs`）:

| Command                   | Parameters                | Returns           | Description                                 |
| ------------------------- | ------------------------- | ----------------- | ------------------------------------------- |
| `read_file`               | `path`                    | `FileInfo`        | Read file content                           |
| `save_file`               | `path, content`           | `SaveResult`      | Write file content                          |
| `file_exists`             | `path`                    | `bool`            | Check existence                             |
| `read_directory`          | `ReadDirectoryParams`     | `FileTreeItem[]`  | File tree data                              |
| `create_file`             | `path`                    | `null`            | Create empty file                           |
| `create_folder`           | `path`                    | `null`            | Create directory                            |
| `rename_path`             | `oldPath, newPath`        | `null`            | Rename/move file or folder                  |
| `delete_path`             | `path`                    | `null`            | Delete (folder: recursive)                  |
| `copy_path`               | `oldPath, newPath`        | `null`            | Copy (folder: recursive)                    |
| `reveal_in_folder`        | `path`                    | `null`            | Reveal in system file manager               |
| `pdf_export_supported`    | —                         | `bool`            | 平台是否支持 PDF 直存（macOS/Windows 支持） |
| `export_pdf_file`         | `html, outputPath, title` | `ExportPdfResult` | 隐藏窗口渲染 → 原生 print-to-PDF 静默写文件 |
| `print_pdf`               | `fileName`                | `ExportPdfResult` | 打印对话框（PDF 直存不支持时的回退路径）    |
| `rebuild_menu`            | `lang, recentFiles`       | `null`            | Rebuild native menu (i18n / recent files)   |
| `set_menu_item_enabled`   | `id, enabled`             | `null`            | Native menu item enabled state              |
| `set_menu_item_checked`   | `id, checked`             | `null`            | Native menu check item state                |
| `update_dock_menu`        | `lang, recentFiles`       | `null`            | Rebuild macOS Dock menu（其他平台 no-op）   |
| `report_window_state`     | `path, dirty`             | `null`            | 前端上报本窗口文档状态（窗口注册表）        |
| `open_in_new_window`      | `path?`                   | `String`(label)   | 新建文档窗口（file-new / 路由新建）         |
| `route_open`              | `paths`                   | `null`            | 打开路径智能路由（聚焦/复用/新建）          |
| `take_startup_open_files` | —（按窗口 label）         | `String[]`        | 取走本窗口启动待打开队列                    |

Adding a command: implement `#[tauri::command]` in `lib.rs`, register in `generate_handler![]`, invoke via `@tauri-apps/api/core`. Struct fields cross the bridge as camelCase (`#[serde(rename = "isDirectory")]`).

## Keyboard Shortcuts

| Shortcut                           | Action                                 | Implementation                                                                                                            |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Cmd/Ctrl + O / S / Shift+S`       | Open / Save / Save As                  | 原生菜单（桌面端）/ `useKeyboardShortcuts.ts`（浏览器）                                                                   |
| `Cmd/Ctrl + N`                     | 新建**窗口**（多窗口 SDI）             | 原生菜单 → open_in_new_window；浏览器端仍为原地新建（`useKeyboardShortcuts.ts`）                                          |
| `Cmd/Ctrl + Shift+O`               | 打开文件夹                             | 原生菜单（文件菜单）                                                                                                      |
| `Cmd/Ctrl + /`                     | WYSIWYG ⇄ Source 切换                  | `useKeyboardShortcuts.ts`（刻意不入菜单——与视图模式 check 项并列易混淆；桌面端无 accelerator 占用，keydown 直达 webview） |
| `Cmd/Ctrl + B / I / K`             | Bold / Italic / Link                   | 原生菜单（格式菜单，桌面端）→ editor-format；浏览器走 CM keymap / Milkdown keymap                                         |
| `Cmd/Ctrl + 0`                     | 正文（剥掉块级前缀）                   | 原生菜单（段落菜单，桌面端）                                                                                              |
| `Cmd/Ctrl + 1 ~ 6`                 | Heading 1 ~ 6                          | 原生菜单（段落菜单，桌面端）→ editor-format；浏览器走 CM keymap / `wysiwygShortcutPlugin`（仅 1~3）                       |
| `Cmd/Ctrl + Alt+Q / U / O / X / C` | 引用 / 无序 / 有序 / 任务列表 / 代码块 | 原生菜单（段落菜单，桌面端）→ editor-format                                                                               |
| `Cmd/Ctrl + Shift+V`               | 粘贴为纯文本                           | 原生菜单（编辑菜单）→ clipboard 读文本 → editor-insert                                                                    |
| `Cmd/Ctrl + Z / Shift+Z`           | Undo / Redo                            | 原生菜单 → editor-undo/redo；CM / Milkdown history                                                                        |
| `Cmd/Ctrl + F`                     | Find & replace                         | 原生菜单 → editor-find → `@codemirror/search`                                                                             |
| `Cmd/Ctrl + =/+ / -`               | Zoom in / out                          | 原生菜单 / `Editor.tsx`                                                                                                   |
| `Cmd/Ctrl + Shift+0`               | Zoom reset（⌘0 已让位「正文」）        | 原生菜单 / `Editor.tsx`                                                                                                   |
| `Cmd/Ctrl + ,`                     | Settings                               | 原生菜单（App/File 菜单）                                                                                                 |
| `Cmd/Ctrl + Shift+B`               | Toggle Sidebar                         | 原生菜单（View 菜单）                                                                                                     |
| `Ctrl+Cmd + 1 / 2`（仅 macOS）     | 侧栏 文件 / 大纲 tab                   | 原生菜单（View 菜单 check 项）                                                                                            |
| `Cmd/Ctrl + Alt+1~4`               | WYSIWYG / Source / Split / Preview     | 原生菜单（View 菜单 check 项）                                                                                            |
| `Cmd/Ctrl + P`                     | Export PDF                             | 原生菜单 / `MoreMenu`                                                                                                     |
| `Escape`                           | Exit edit mode                         | `Editor.tsx`                                                                                                              |

## Architecture Notes & Gotchas

Read these before touching editor code — details in `docs/implementation-notes.md`:

- **Dual editor cores**: WYSIWYG = Milkdown/ProseMirror（`WysiwygEditor.tsx`），Source/Split = CodeMirror 6（`CodeMirrorEditor.tsx`），都常驻挂载（非激活 hidden）。Markdown 源码是唯一事实来源；两侧事件 handler 与 `canUndo/canRedo` 写入都按 `viewMode` 门控
- **Milkdown**: `@milkdown/kit` 必须子路径导入；自定义语法（admonition/PlantUML/本地图片/任务列表 checkbox/数学公式）全是纯 DOM `$view` nodeview + `$remark` mdast 变换，往返无损有测试锁定；**commonmark 预设剔除了 `remark-preserve-empty-line`**（它把空段落序列化成独立 `<br />` 行，用户视为垃圾——剔除后空段落 = 普通空行，重载自然折叠；源码已有的 `<br />` 行解析为 html 节点保留）
- **数学公式（KaTeX）**: 双端实现——markdown-it 侧 `src/lib/markdown/mathPlugin.ts`（自写 inline/block rule），WYSIWYG 侧 `mathPlugin.ts`（remark-math + math_inline/math_block atom schema）+ `mathView.ts`（点击进 textarea 编辑态）；**语法规则严格对齐 micromark-extension-math 3.x**（块级仅多行围栏，单行 `$$x$$` 是行内公式；无 pandoc 货币保护），两侧规则不一致会导致模式切换抖动；PDF 导出经 `exportPdf.ts inlineKatexFonts` 把 woff2 字体转 base64 内联（vividmark-pdf:// 协议窗口加载不到应用字体）
- **Source 模式格式化**: `src/lib/markdownEditing.ts`（纯函数，可单测）；store ↔ CM 文档同步必须防回环（写入前比较当前值）
- **Scroll container refs**: preview/outline scroll code requires the ref on the _scrollable container_ (`overflow-auto` div), not on `.markdown-body`
- **Split scroll sync**: percentage-based, guarded by an `isSyncingScroll` flag + 50ms timeout to prevent infinite loops；编辑器侧滚动容器是 CM 的 `view.scrollDOM`
- **Cross-component events**: `CustomEvent` bus on `window` — `editor-format` / `editor-insert` / `editor-undo` / `editor-redo`（菜单/工具栏 → 编辑器），`editor-scroll-to-heading` (outline nav), `editor-export-pdf` (PDF export), `editor-find` (原生菜单 Find), `app-open-dialog` (原生菜单 → Toolbar 的表格/提示框对话框), `file-open-request` (文件关联打开)
- **WYSIWYG Enter 模型**: 普通段落 Enter = 行内软换行（源码单换行、行间无空行），Enter×2 = 新段落；列表/标题/代码块行为不变（`wysiwygEnterCommand`，IME 回车补偿共用）。CM 的 defaultKeymap 已移除 `Mod-/`（toggleComment 会把内容注释成 `<!-- -->`，与模式切换冲突）。中文 IME（WKWebView）的幻影节点/回车吞键有专门插件链，细节见 implementation-notes「中文 IME 组合输入系列问题」
- **多窗口（Typora 式 SDI）**: 每文档独立窗口（独立 webview/JS 上下文，单文档 store 无需重构）。核心在 `src-tauri/src/window_router.rs`：窗口注册表 `WINDOW_STATES`（前端经 `report_window_state` 上报 filePath/isDirty）+ `LAST_FOCUSED`（on_window_event Focused/Destroyed 维护）+ 启动待打开队列（按窗口 label）。**打开路径路由**（route_open_paths）：已打开→聚焦；干净空窗口→复用（定向 `file-open-request`）；否则 `create_document_window` 新建（macOS 融合标题栏三件套在 builder 里 cfg 门控复制；新建前有 pending 去重，防重复触发建出重复窗口）。菜单/Dock 事件经 `emit_to_focused` 定向 LAST_FOCUSED（tauri 菜单事件不携带窗口来源；macOS 菜单点击不改 key window、Windows 点菜单必先聚焦）。前端 `src/lib/windowManager.ts`：状态上报 / onCloseRequested 脏确认 / **跨窗口偏好同步经 `prefs-sync` tauri 事件广播**（themeMode·language·recentFiles，值比较防回声；⚠️ 不能用 localStorage storage 事件——实测 macOS WKWebView 多窗口各自独立 localStorage，不共享不触发）；菜单 check/enabled 由焦点窗口驱动（nativeMenu.ts 焦点门控 + onFocusChanged 全量重同步 + **rebuildMenu payload 去重**，内容未变不重建）。capabilities `windows: ["*"]`（动态 label）。PDF 隐藏窗口 label 排除在路由外
- **原生菜单事件流**: `src-tauri/src/menu.rs` 构建系统菜单（macOS App/文件/编辑/段落/格式/视图/窗口；Windows/Linux 适配）→ `on_menu_event` 经 `emit_to_focused` 定向 emit `native-menu-event` → `src/lib/nativeMenu.ts` `handleMenuAction` 分发。带 accelerator 的键在桌面端被 OS 拦截，webview 收不到 keydown —— 桌面端快捷键由菜单事件驱动，`useKeyboardShortcuts` 仅浏览器 dev/E2E 生效，互不重迭。**id 约定与右键菜单同源**：`format:<FormatType>` → editor-format 事件总线（FormatType 含 h1-h6/ol/paragraph 等，`markdownEditing.ts` 与 `wysiwygFormat.ts` 双端实现）；`insert:image` 走 `editorActions.ts` 共享流程、`insert:table|admonition` 经 `app-open-dialog` 打开 Toolbar 挂载的对话框、`insert:hr` 走 editor-insert。菜单 check/enabled 态与语言/最近文件由 store 订阅经 `set_menu_item_checked/enabled`/`rebuild_menu` 同步（**`Menu::get` 只查顶层项，子菜单内的项必须走 lib.rs 的 `find_menu_item` 递归查找；muda CheckMenuItem 点击会原生自动翻转勾选，最终态以同步为准；菜单重建后 check/enabled 回到构建默认值，必须重新同步一轮**）；Edit 的 Undo/Redo 用自定义项（系统级 undo 会绕过 CM/Milkdown history）
- **macOS Dock 右键菜单**: `src-tauri/src/dock_menu.rs`（仅 macOS）——Tauri/muda/tao 均无 API，用 objc2 运行时给 tao AppDelegate 类 `class_addMethod(applicationDockMenu:)`，菜单项动作复用 `native-menu-event` 通道（file-new/file-open/open-recent:\*/clear-recent，同样经 emit_to_focused 定向）；前端在 rebuild_menu 的同订阅点调 `update_dock_menu` 重建。**tao 升级需回归验证**
- **文件关联（Open With）**: `tauri.conf.json` `bundle.fileAssociations` 声明 md/markdown 等扩展（仅打包安装后生效，LaunchServices 注册）；macOS 双击/打开方式 → `RunEvent::Opened` → `route_open_paths` 窗口路由（聚焦/复用/新建；冷启动入 main 启动队列）→ `src/lib/openWith.ts`（启动积压由 `take_startup_open_files` 按 label 补取）；Windows/Linux 关联已生成但 argv 打开未接（后续项，含单实例）
- **Task list checkboxes**: with `dangerouslySetInnerHTML`, never read `checkbox.checked` — use the `data-task-status` attribute and re-sync DOM state in a `useEffect` after each render
- **Windows paths**: normalize `\` → `/` before any path math (`imageUtils.getRelativePath`, `parser.resolveRelativePath`, Editor `baseDir`)
- **External links**: intercept clicks in preview, `e.preventDefault()`, open via `@tauri-apps/plugin-shell` (requires `shell:default` capability)
- **Window title**: Typora 式 `文件名 ●`（● = unsaved；多窗口下 Dock 窗口列表/Mission Control 依文件名区分），Toolbar.tsx 经 `@tauri-apps/api/window` setTitle；**capabilities 必须显式授 `core:window:allow-set-title`**（tauri 2.10+ 非默认，否则 IPC 被 ACL 静默拒绝、标题恒为 conf 初始值——曾致 Dock 窗口列表全部显示 "VividMark"）
- **主题约定**: globals.css 顶部 `@custom-variant dark (&:where(.dark, .dark *))` — `dark:` 变体跟随应用内 `.dark` class（挂 documentElement），不再是系统媒体查询；颜色一律走 CSS 变量（`--hover-bg`/`--active-bg`/`--color-text-muted` 等，:root 与 .dark 双定义），新组件禁止 Tailwind 灰色硬编码
- **菜单原语**: 下拉/右键菜单统一用 `src/components/Menu/`（Dropdown / ContextMenu / MenuPanel），禁止再复制 outside-click 模式；ContextMenu 的 `onClose` 必须 useCallback 稳定化；MenuPanel 支持一层子菜单（`MenuSubmenuItem.children`，hover/点击展开，右缘翻左、底部上收）
- **编辑器右键菜单**: 三区域（Source/Preview/WYSIWYG）均已接入，结构对齐 Typora（剪贴板组 + 段落▸/格式▸/插入▸ 子菜单）。菜单项构建是纯函数（`src/lib/contextMenu.ts`，id/文案/disabled/快捷键标注），状态用 `src/hooks/useContextMenu.ts`；动作按 id 前缀分发——`format:*` 转发 editor-format 事件总线，剪贴板走 `src/lib/clipboard.ts`（桌面端 `@tauri-apps/plugin-clipboard-manager`，浏览器降级 navigator.clipboard），WYSIWYG 上下文动作（表格行列增删/链接/图片/代码块/`insert:*`）在 `wysiwygContextMenu.ts`（表格删除是自实现 PM transaction，不走 milkdown selectRow/deleteSelectedCells 的 index 语义；表头行禁删；「在上方/下方插入段落」= 在当前顶层块前后插空段落并落入光标）。**WebKit 右键抢选**：WKWebView 在 mousedown→contextmenu 之间抢先写 DOM 词/行选择（不可取消），必须 contextmenu 时折叠选区 + `getSelection().collapse(domAtPos)` 把 DOM 选择压回光标（细节见 implementation-notes）
- **macOS 融合标题栏**: tauri.conf.json `titleBarStyle: Overlay` + `hiddenTitle`（仅 macOS 生效）；`trafficLightPosition: {x:12, y:25.5}` 把红绿灯垂直居中到 48px 工具栏（tao 语义：标题栏高 = 按钮高 14pt + y，按钮贴容器底部；居中公式 y = 目标按钮顶距 + 8.5pt）；App 给 documentElement 加 `is-macos` class（判定走 `src/lib/platform.ts`）；Toolbar 根 `data-tauri-drag-region` + macOS 下 `pl-[78px]`（traffic light 预留）+ 自绘居中标题（<760px 隐藏）。**窗口拖拽/标题权限坑**：tauri 2.10+ 起 `core:window:allow-start-dragging` 与 `core:window:allow-set-title` 均非默认权限，capabilities 必须显式授予，否则 IPC 被 ACL 静默拒绝（拖拽失效 / 标题恒为初始值）；② Tauri 的 drag.js 只查 `e.target` 自身属性（无 closest 上溯），子元素覆盖区域不触发——所以 Toolbar 的左/右分组容器也带 `data-tauri-drag-region`
- **Logging**: use `createLogger('Module')` from `src/lib/logger.ts` (frontend) and `tauri-plugin-log` (backend); logs at `~/Library/Logs/com.vividmark.app/` on macOS
- **PDF 直存管线**: 菜单/MoreMenu/右键 → `editor-export-pdf` 事件 → `exportPdf.ts exportCurrentDocument()` → 保存对话框 → 序列化应用 CSS + `parseMarkdownAsync` 生成独立 HTML（含打印密度覆盖：14px 字号/紧凑单元格/首列不换行）→ `export_pdf_file` 命令：隐藏 Webview 窗口（`vividmark-pdf://` 自定义协议 serve HTML，`on_page_load` Finished 等渲染，15s 超时兜底）→ macOS `NSPrintOperation(SaveJob)` / Windows `PrintToPdf` 静默写文件；**PDF 书签大纲**：前端从渲染 HTML 提取标题随 `outline` 参数传入，macOS 用 PDFKit 后处理重建（WebKit 不生成 outline；文本提取有兼容表意文字坑，匹配需 NFKC+去空白+部首通配，见 implementation-notes）；Linux/旧 runtime 回退 `print_pdf` 打印对话框。**macOS 关键坑**：必须 `sharedPrintInfo` copy + `canSpawnSeparateThread(true)` + `runOperationModalForWindow`（全新 `NSPrintInfo` + `run()` 会无限分页；`createPDFWithConfiguration` 是整页长截图不分页），细节见 implementation-notes

## Known Issues

- **代码块中英文对齐**: WebView 无法保证全角:半角 = 2:1，ASCII 图混排中英文无法对齐。多种等宽字体方案均无效，建议用 Mermaid/PlantUML 替代（分析见 implementation-notes）
- **PDF 直存平台差异**: macOS（NSPrintOperation SaveJob）/ Windows（WebView2 PrintToPdf）支持静默存盘；Linux（webkit2gtk 未绑定 print_to_pdf）回退系统打印对话框
- **WYSIWYG 已知限制**: 表格创建用 `|CxR| ` 语法；已有 admonition 的类型/标题需切 source 修改；slash menu / 悬浮格式条与 WYSIWYG 查找替换未接（详见 implementation-notes）

## CI/CD & Release

- `.github/workflows/test.yml`: lint + typecheck + unit tests (coverage → Codecov)
- `.github/workflows/release.yml`: push `v*` tag → multi-platform build (macOS/Windows/Linux) → GitHub Release
- `.github/workflows/pages.yml`: `docs/` → GitHub Pages
- Version numbers must stay in sync: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
- Unsigned app notes: macOS Gatekeeper (`xattr -rd com.apple.quarantine`), Windows SmartScreen warning

## Working Agreements

- 任务进度只更新 `PLAN.md`，不要在 AGENTS.md 中维护任务看板
- 实现细节、踩坑记录写入 `docs/implementation-notes.md`；AGENTS.md 只保留精简指南
- 修改了本文件提及的任何约定（命令、结构、工作流）时，同步更新本文件
- 用户可见的功能变更同步更新 `README.md`（及 `README.zh-CN.md`）
