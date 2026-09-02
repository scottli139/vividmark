# VividMark - Agent Guide

Essential information for AI coding agents working on the VividMark project. Keep this file lean — deep implementation notes live in `docs/implementation-notes.md`, task tracking lives in `PLAN.md`.

## Project Overview

**VividMark** is a lightweight Markdown editor built with **Tauri 2.0 + React 19 + TypeScript**, providing a Typora-inspired, distraction-free writing experience.

Key features:

- Four view modes: WYSIWYG (default, Milkdown/ProseMirror) / Source / Split / Preview
- CodeMirror 6 source editor: Markdown highlighting, smart list continuation, find & replace
- Real-time Markdown preview (markdown-it + highlight.js)
- Markdown extensions: admonitions（`:::` / `!!!` / GitHub Alerts `> [!NOTE]`）, footnotes（`[^id]`）, 排版增强（`==`高亮/`^`上标/`~`下标/emoji 短码）, PlantUML（本地引擎离线渲染）, Mermaid（懒加载离线渲染）, task lists, tables, math formulas (KaTeX), YAML frontmatter
- File operations with native dialogs, auto-save (2s idle), drag & drop, recent files
- Multi-window (Typora-style SDI): one window per document with smart open routing (focus / reuse / new window)
- Native menubar (File/Edit/Paragraph/Format/View), macOS Dock menu & file associations (Open With)
- Sidebar with outline navigation and resizable file tree; status bar (sidebar toggle, word count, cursor, view mode, zoom)
- i18n (en / zh-CN), dark mode, 50–200% zoom, PDF export
- Export opened folder as a deployable static site (built-in generator, no external deps; MkDocs config-aware — `mkdocs.yml` 的 nav/docs_dir 驱动导出)

## Documentation Map

| File                                                               | Content                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `PLAN.md`                                                          | 开发计划与任务进度（唯一的任务看板，不在本文件重复）                             |
| `docs/implementation-notes.md`                                     | 实现细节知识库：已知问题、架构要点、Tauri 命令/快捷键一览表、发布流程、Git 规范  |
| `docs/session-log.md`                                              | 历史开发日志（Session 记录，自 PLAN.md 归档）                                    |
| `docs/REQUIREMENTS.md`                                             | 需求文档                                                                         |
| `docs/ux-improvement-plan.md`                                      | Typora 对标体验差距分析与 P0–P3 改进方案                                         |
| `docs/wysiwyg-research.md` + `docs/wysiwyg-implementation-plan.md` | WYSIWYG 模式调研与实现计划（自研路线，已被 P2 取代）                             |
| `docs/typst-offline-plan.md`                                       | Typst 离线支持计划（⏸️ 暂停中，2026-08-12 评估转向独立产品）                     |
| `docs/typst-standalone-editor-plan.md`                             | 独立 Typst 编辑器预研（📋 未立项；与 VividMark 分离的产品方向）                  |
| `docs/word-export-plan.md`                                         | Word（docx）导出可行性与实现方案（📋 方案待评审，pandoc 路线）                   |
| `docs/site-export-config-plan.md`                                  | 「导出为网站」mkdocs/vuepress 配置感知方案（✅ 全部落地：mkdocs nav/docs_dir/exclude_docs/`!!!`；vuepress public/title best-effort）         |
| `docs/syntax-extensions-plan.md`                                   | Markdown 扩展语法盘点与方案（✅ 批次 1–5 全部落地：Alerts/脚注/frontmatter/Mermaid/排版批） |
| `CONTRIBUTING.md`（+ `.zh-CN`）                                    | 贡献指南：环境搭建、提交前检查链、PR 流程、AI 辅助贡献政策                       |
| `linglong/README.md`                                               | 玲珑（Linglong）打包方案与踩坑记录（UOS 20 等老系统；构建入口 `linglong.yaml` + `linglong/build.sh`） |

## Technology Stack

| Category    | Technology                                                  |
| ----------- | ----------------------------------------------------------- |
| Frontend    | React 19 + TypeScript + Vite 7                              |
| Desktop     | Tauri 2.0 (Rust)                                            |
| Editor      | CodeMirror 6（源码）+ Milkdown 7（所见即所得，ProseMirror） |
| Styling     | Tailwind CSS 4                                              |
| State       | Zustand 5 (persist 用户偏好)                                |
| i18n        | i18next + react-i18next                                     |
| Markdown    | markdown-it + highlight.js + KaTeX                          |
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
│   ├── lib/                  # markdown/ markdownEditing textStats plantuml mermaid imageSrc
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

命令定义在 `src-tauri/src/lib.rs`（PDF 在 `pdf.rs`、站点导出在 `site_export.rs`、多窗口路由在 `window_router.rs`、窗口标题在 `titlebar.rs`）。**全部命令的参数/返回值一览表见 `docs/implementation-notes.md`「Tauri Commands 一览」**。

新增命令：实现 `#[tauri::command]` → 注册进 `generate_handler![]` → 前端经 `@tauri-apps/api/core` invoke；结构体字段跨桥为 camelCase（`#[serde(rename = "isDirectory")]`）。

## Keyboard Shortcuts

**完整快捷键表见 `docs/implementation-notes.md`「键盘快捷键一览」**。核心约定：带 accelerator 的键在桌面端被 OS 拦截（webview 收不到 keydown），桌面端快捷键全部由原生菜单事件驱动；`useKeyboardShortcuts.ts` 仅在浏览器 dev/E2E 生效，两者互不重迭。

## Architecture Notes & Gotchas

Read these before touching editor code — 每条只保留核心约束，展开细节均在 `docs/implementation-notes.md`（下称 notes）：

- **Dual editor cores**: WYSIWYG = Milkdown/ProseMirror（`WysiwygEditor.tsx`），Source/Split = CodeMirror 6（`CodeMirrorEditor.tsx`），常驻挂载（非激活 hidden）。Markdown 源码是唯一事实来源；两侧事件 handler 与 `canUndo/canRedo` 写入都按 `viewMode` 门控
- **Milkdown**: `@milkdown/kit` 必须子路径导入；自定义语法（admonition/PlantUML/本地图片/任务列表/数学公式/frontmatter）全是纯 DOM `$view` nodeview + `$remark` mdast 变换，往返无损有测试锁定；commonmark 预设剔除了 `remark-preserve-empty-line`（空段落 = 普通空行；源码已有 `<br />` 行仍解析为 html 节点保留）；**`$remark` options 默认 `{}` 原样进 `.use()`**——校验 options 的 remark 插件必须显式传第三参（如 frontmatter 传 `'yaml'`，细节见 notes）
- **数学公式（KaTeX）**: 双端实现（markdown-it 侧 `src/lib/markdown/mathPlugin.ts` 自写 rule；WYSIWYG 侧 `mathPlugin.ts` + `mathView.ts` 点击编辑）；**语法规则严格对齐 micromark-extension-math 3.x**（块级仅多行围栏，单行 `$$x$$` 是行内公式），两侧不一致会导致模式切换抖动
- **GitHub Alerts（`> [!NOTE]`）**: 双端共用 `src/lib/markdown/githubAlert.ts` 的 `matchAlertMarkerLine`（仅五类、大小写不敏感；**须容忍自家序列化产物** `\[` 转义与行尾 `\`）。预览侧 `githubAlertPlugin.ts` 是 core rule 后处理 blockquote token（改写为 admonition 三段式 HTML，剥离标记）；WYSIWYG 侧 `githubAlertDecorations.ts` 是**纯 PM Decoration**（零 schema 变更：blockquote 注入 `admonition <type>` class 复用配色，标记行可见可编辑）；未知类型/折叠标记 `+-`/同行跟文本一律降级普通引用
- **脚注（`[^id]`）**: WYSIWYG 零新增 schema——Milkdown `gfm` 预设自带 `footnote_reference`/`footnote_definition` 节点，remark-gfm 包办解析与序列化（往返无损有测试锁定）；编号是纯装饰（`footnoteDecorations.ts` 按引用首现顺序注入 `data-footnote-number`，CSS 替换 label 显示为 `[N]`，悬空引用不编号降级显示 label）。预览侧 `markdown-it-footnote`（caption 覆写恒 `[N]`；未引用定义不渲染同 GitHub）；预览 `#fn` 锚点点击改页内 scrollIntoView，不走出站
- **排版增强（`==`/`^`/`~`/emoji）**: 预览侧 `markdown-it-mark`/`sup`/`sub`/`emoji`（parser.ts 链式 `.use()`）；WYSIWYG 侧 `typographyPlugin.ts` 自写三件套——pairedDelimiter micromark 扩展工厂（定长配对分隔符，flanking 规则与 GFM strikethrough 一致）+ mdast fromMarkdown/toMarkdown（节点 mark/superscript/subscript 行内容器，PM mark 非 node）+ 输入规则。**gfm 预设剔除了 remarkGFMPlugin 与 strikethroughInputRule**（引用比较过滤）：前者以 `{ singleTilde: false }` 重注册（单 `~` 归下标，`~~` 删除不变），后者替换为 `~~` 限定版（原规则会把单 `~` 输入转删除线并序列化成 `~~`）；序列化转义策略：`=` 仅转义成对的第二个（`a = b` 不污染）、`^` 全转义、`~` 沿用 gfm strikethrough 既有 unsafe；超长分隔符（`===`/`^^`）WYSIWYG 整体字面、预览解析内层对（病态写法，examples 有记录）；emoji 按决策仅预览侧，WYSIWYG 字面短码零建模
- **PlantUML 本地渲染（离线）**: `@plantuml/core`（TeaVM）拷至 `vendor/plantuml/`（不进 git），懒加载；**引擎共享内部状态，必须串行渲染**（统一入口 `src/lib/plantuml.ts`：Promise 队列 + 缓存 + inflight 去重，失败回退在线 img）。markdown-it 只产 `data-plantuml-src` 占位符（先掩码围栏/行内代码区）；预览渐进渲染的 **effect deps 必须含 viewMode**；导出走 `parseMarkdownAsync { inlinePlantUml: true }` 内联 SVG；jsdom 无 canvas——单测注假引擎，真机冒烟 `e2e/plantuml.spec.ts`
- **Mermaid（离线）**: 官方 `mermaid` 包 dynamic import 拆 chunk 懒加载（`src/lib/mermaid.ts`，与 plantuml 同款串行队列/缓存/inflight——initialize 全局配置 + render 挂 body 临时容器，并发不安全）；dark 变化重新 initialize 重渲；**无在线回退**——失败（多为语法错误）统一 `pre.mermaid-error` 错误态展示源码。仅 ` ```mermaid ` 围栏形态（无行内语法、无需掩码），占位符/渐进渲染/导出内联（`inlineMermaid`）与 PlantUML 同管线；**图表占位符不包 pre/code**（fence 规则已覆写——pre 的等宽字体 !important 会压进 SVG foreignObject，与 mermaid 量尺寸字体不一致裁断文字）；时序图 `sequence.height` 收紧为 46，**`dominant-baseline="central"` 文本统一改写为绝对 y 偏移**（WebKit 不认该属性，WKWebView 文字偏高 ~0.35em，见 notes）；gitGraph 分支标签 `tspan dy="1em"` 改写为绝对 y（WKWebView 解析 dy 的 em 偏离 font-size 致文字偏下，见 notes）；WYSIWYG 由 plantUmlCodeBlockView 按 language 分派双区（kind 变化 update() 返回 false 重建）；jsdom 注假渲染器，真机冒烟 `e2e/mermaid.spec.ts`
- **React 19 预览 innerHTML 恒重置**: `dangerouslySetInnerHTML` 按**对象 identity** 比对、setProp 无条件重写 innerHTML——预览 prop 必须 memo 化（Editor.tsx `previewHtmlProp`），否则缩放等无关重渲染把渐进渲染的图表 DOM 重置回占位符（细节见 notes「React 19」）
- **Source 模式格式化**: `src/lib/markdownEditing.ts`（纯函数，可单测）；store ↔ CM 文档同步必须防回环（写入前比较当前值）
- **文件变更监控**: Rust `file_watch.rs` 按窗口监听**父目录**过滤目标文件（notify，300ms 防抖，窗口 Destroyed 释放）；前端 `src/lib/fileWatcher.ts` 分流——干净静默重载 / 脏冲突弹窗（未决期 `useAutoSave` 暂停）/ 删除提示一次（保存重建后复位）；自身保存回声靠 `lastKnownContent` 读盘比对抑制（fileOps open/save 埋点 `markFileContentKnown`）
- **Scroll container refs**: preview/outline scroll code requires the ref on the _scrollable container_ (`overflow-auto` div), not on `.markdown-body`
- **Split scroll sync**: percentage-based, guarded by an `isSyncingScroll` flag + 50ms timeout to prevent infinite loops；编辑器侧滚动容器是 CM 的 `view.scrollDOM`
- **Cross-component events**: `CustomEvent` bus on `window` — `editor-format` / `editor-insert` / `editor-undo` / `editor-redo`（菜单/工具栏 → 编辑器），`editor-scroll-to-heading` (outline nav), `editor-export-pdf` (PDF export), `editor-find` (原生菜单 Find), `app-open-dialog` (原生菜单 → Toolbar 对话框), `app-open-image-viewer` (图表/图片全屏查看器，detail `{ html }`), `file-open-request` (文件关联打开)
- **WYSIWYG Enter 模型**: 普通段落 Enter = 行内软换行，Enter×2 = 新段落；列表/标题/代码块行为不变（`wysiwygEnterCommand`）。CM 的 defaultKeymap 已移除 `Mod-/`（toggleComment 与模式切换冲突）；中文 IME（WKWebView）幻影节点/回车吞键有专门插件链（notes「中文 IME 组合输入系列问题」）
- **多窗口（Typora 式 SDI）**: 每文档独立窗口（独立 webview/JS 上下文）。核心 `src-tauri/src/window_router.rs`：注册表 `WINDOW_STATES`（前端 `report_window_state` 上报）+ `LAST_FOCUSED` + 启动待打开队列；打开路由 = 已打开→聚焦 / 干净空窗口→复用 / 否则新建（pending 去重）。**跨窗口偏好同步走 `prefs-sync` tauri 事件广播——不能用 localStorage storage 事件**（macOS WKWebView 多窗口 localStorage 各自独立）；菜单/Dock 事件经 `emit_to_focused` 定向；capabilities 需 `windows: ["*"]`；PDF 隐藏窗口 label 排除在路由外
- **原生菜单事件流**: `menu.rs` 构建 → `on_menu_event` 经 `emit_to_focused` emit `native-menu-event` → `nativeMenu.ts handleMenuAction` 分发（桌面端快捷键全走此路，见上「Keyboard Shortcuts」）。id 约定与右键菜单同源（`format:<FormatType>` / `insert:*`）；查子菜单项必须走 lib.rs `find_menu_item` 递归（`Menu::get` 只查顶层）；CheckMenuItem 点击会原生自动翻转勾选，最终态以同步为准；**菜单重建后 check/enabled 回到构建默认值，必须重同步一轮**；Edit 的 Undo/Redo 用自定义项（系统级 undo 会绕过编辑器 history）
- **macOS Dock 右键菜单**: `dock_menu.rs`（仅 macOS）用 objc2 给 tao AppDelegate `class_addMethod(applicationDockMenu:)`；动作复用 `native-menu-event` 通道（file-new/file-open/open-recent:\*/clear-recent）；**tao 升级需回归验证**
- **文件关联（Open With）**: `tauri.conf.json` `bundle.fileAssociations`（仅打包安装后生效，LaunchServices 注册）；macOS `RunEvent::Opened` → `route_open_paths` 窗口路由 → `src/lib/openWith.ts`（启动积压由 `take_startup_open_files` 按 label 补取）；Windows/Linux argv 打开未接（后续项，含单实例）
- **Task list checkboxes**: with `dangerouslySetInnerHTML`, never read `checkbox.checked` — use the `data-task-status` attribute and re-sync DOM state in a `useEffect` after each render
- **Windows paths**: normalize `\` → `/` before any path math (`imageUtils.getRelativePath`, `parser.resolveRelativePath`, Editor `baseDir`)
- **External links**: intercept clicks in preview, `e.preventDefault()`, open via `@tauri-apps/plugin-shell` (requires `shell:default` capability)
- **Window title**: Typora 式 `文件名 ●`（● = unsaved）。**前端禁止直接调 setTitle**——必须走 `set_window_title` 命令（titlebar.rs，设题后重排红绿灯）；窗口类权限（`core:window:allow-set-title` / `allow-start-dragging` / `allow-destroy`）tauri 2.10+ 非默认，capabilities 必须显式授予，否则标题失效 / 无法拖拽 / **窗口无法关闭**
- **主题约定**: globals.css 顶部 `@custom-variant dark (&:where(.dark, .dark *))` — `dark:` 变体跟随应用内 `.dark` class（挂 documentElement），不再是系统媒体查询；颜色一律走 CSS 变量（`--hover-bg`/`--active-bg`/`--color-text-muted` 等，:root 与 .dark 双定义），新组件禁止 Tailwind 灰色硬编码
- **菜单原语**: 下拉/右键菜单统一用 `src/components/Menu/`（Dropdown / ContextMenu / MenuPanel），禁止再复制 outside-click 模式；ContextMenu 的 `onClose` 必须 useCallback 稳定化；MenuPanel 支持一层子菜单（`MenuSubmenuItem.children`，右缘翻左、底部上收）
- **编辑器右键菜单**: 三区域（Source/Preview/WYSIWYG）接入，结构对齐 Typora（剪贴板组 + 段落▸/格式▸/插入▸ 子菜单）。菜单项构建是纯函数（`src/lib/contextMenu.ts`），动作按 id 前缀分发（`format:*` → editor-format；剪贴板走 `src/lib/clipboard.ts`；WYSIWYG 上下文动作在 `wysiwygContextMenu.ts`）。**WebKit 右键抢选**：落点选区外时 contextmenu 折叠选区 + `getSelection().collapse(domAtPos)` 压回 DOM 选择；落点选区内时经「mousedown 快照/当前/selectionchange 选区史（doc 校验）」候选恢复 + 菜单打开期间选区守卫锁定（细节见 notes）。**剪贴板权限**：`clipboard-manager:default` 权限集为空（2.3.2 起），capabilities 必须显式 `allow-read-text`/`allow-write-text`，否则桌面端复制/粘贴被 ACL 静默拒绝
- **macOS 融合标题栏**: `titleBarStyle: Overlay` + `hiddenTitle`（仅 macOS）；`trafficLightPosition {x:12, y:25.5}` 把红绿灯垂直居中到 48px 工具栏；`is-macos` class 判定走 `src/lib/platform.ts`；Toolbar 根及左/右分组容器都带 `data-tauri-drag-region`（Tauri drag.js 只查 `e.target` 自身属性）+ macOS 下 `pl-[78px]` + 自绘居中标题（<760px 隐藏）；**红绿灯位置会被 setTitle 重置**（故标题只能走 `set_window_title`，见上「Window title」）
- **Logging**: use `createLogger('Module')` from `src/lib/logger.ts` (frontend) and `tauri-plugin-log` (backend); logs at `~/Library/Logs/com.vividmark.app/` on macOS
- **导出为网站（静态站点包）**: 菜单/MoreMenu `export-site`（按 `openedFolder` 门控）→ `exportSite.ts` → 纯逻辑 `siteGenerator.ts`（镜像目录结构、README/index→所在目录 index.html、数字前缀排序且显示剥离、`.md` 互链重写 `.html`）→ Rust `export_site` 批量写盘；页面框架 `siteTemplate.ts`（`.dark` 切换、`.nojekyll`）。**配置感知**（`siteConfig.ts`）：风味 mkdocs > vuepress > plain，`mkdocs.yml` 的 nav/docs_dir 驱动导航与范围，nav 是策展白名单（不追加未收录页）；vuepress best-effort：`.vuepress/public/*` 镜像到站点根（public 覆盖同名资产、撞页面名丢弃），config title 正则提取作站点名（隐藏目录检查点：`read_directory` 跳过只作用于列出子项，直读 `.vuepress/public` 可行；`file_exists` 文件或目录皆 true——曾只认 is_file 致目录探测全失效，已修）。关键坑：渲染必须 `parseMarkdownAsync(content, { preserveImages: true, inlinePlantUml: true })`——否则相对图片变 asset:// 死链、UML 需联网
- **PDF 直存管线**: `editor-export-pdf` 事件 → `exportPdf.ts` 生成独立 HTML → `export_pdf_file`（隐藏窗口 `vividmark-pdf://` 渲染，15s 超时兜底）→ macOS `NSPrintOperation(SaveJob)` / Windows `PrintToPdf` 静默写文件；**macOS 必须 sharedPrintInfo copy + canSpawnSeparateThread(true) + runOperationModalForWindow**（全新 NSPrintInfo + run() 会无限分页）；PDF 书签大纲 macOS 用 PDFKit 后处理重建；Linux 回退 `print_pdf` 打印对话框

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
- 新语法/新渲染能力落地时，同步在 `examples/` 添加对应示例文件（kebab-case，对齐 `math-formulas.md` / `plantuml-diagrams.md` 先例；覆盖全部变体与边界写法，兼作手动验收 fixture）
- AI 协助的提交，commit message 末尾加模型 trailer（格式 `Model: <模型名>`，如 `Model: Kimi K3 max`），以当次实际使用的模型为准；纯人工提交不加
