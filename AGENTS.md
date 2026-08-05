# VividMark - Agent Guide

Essential information for AI coding agents working on the VividMark project. Keep this file lean — deep implementation notes live in `docs/implementation-notes.md`, task tracking lives in `PLAN.md`.

## Project Overview

**VividMark** is a lightweight Markdown editor built with **Tauri 2.0 + React 19 + TypeScript**, providing a Typora-inspired, distraction-free writing experience.

Key features:

- Four view modes: WYSIWYG (default, Milkdown/ProseMirror) / Source / Split / Preview
- CodeMirror 6 source editor: Markdown highlighting, smart list continuation, find & replace
- Real-time Markdown preview (markdown-it + highlight.js)
- Markdown extensions: admonitions, PlantUML, task lists, tables
- File operations with native dialogs, auto-save (2s idle), drag & drop, recent files
- Sidebar with outline navigation and resizable file tree; status bar (word count, cursor, zoom)
- i18n (en / zh-CN), dark mode, 50–200% zoom, PDF export

## Documentation Map

| File                                                               | Content                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------ |
| `PLAN.md`                                                          | 开发计划与任务进度（唯一的任务看板，不在本文件重复）   |
| `docs/implementation-notes.md`                                     | 实现细节知识库：已知问题、架构要点、发布流程、Git 规范 |
| `docs/REQUIREMENTS.md`                                             | 需求文档                                               |
| `docs/ux-improvement-plan.md`                                      | Typora 对标体验差距分析与 P0–P3 改进方案               |
| `docs/wysiwyg-research.md` + `docs/wysiwyg-implementation-plan.md` | WYSIWYG 模式调研与实现计划（自研路线，已被 P2 取代）   |
| `docs/typst-offline-plan.md`                                       | Typst 离线支持计划（⏸️ 暂停中）                        |

## Technology Stack

| Category    | Technology                          |
| ----------- | ----------------------------------- |
| Frontend    | React 19 + TypeScript + Vite 7      |
| Desktop     | Tauri 2.0 (Rust)                    |
| Editor      | CodeMirror 6（源码）+ Milkdown 7（所见即所得，ProseMirror） |
| Styling     | Tailwind CSS 4                      |
| State       | Zustand 5 (persist 用户偏好)        |
| i18n        | i18next + react-i18next             |
| Markdown    | markdown-it + highlight.js          |
| Unit Tests  | Vitest + React Testing Library      |
| E2E Tests   | Playwright                          |
| Lint/Format | ESLint (flat config) + Prettier     |

## Project Structure

```
vividmark/
├── src/                      # React frontend
│   ├── components/           # Editor/ Sidebar/ Toolbar/ FileTree/ StatusBar/
│   │                         # Menu/（Dropdown/ContextMenu 菜单原语）Settings/
│   ├── hooks/                # useAutoSave, useFileDragDrop, useKeyboardShortcuts,
│   │                         # useResizable, useDebouncedValue
│   ├── stores/editorStore.ts # Zustand main store
│   ├── lib/                  # markdown/ markdownEditing textStats plantuml imageSrc
│   │                         # fileOps logger imageUtils theme(主题解析) platform(平台检测) ...
│   ├── i18n/                 # i18next config + locales/{en,zh-CN}.json
│   ├── styles/globals.css    # Tailwind + theme CSS variables
│   ├── test/                 # Vitest setup + Tauri mocks
│   └── App.tsx / main.tsx
├── src-tauri/                # Rust backend
│   ├── src/lib.rs            # Tauri commands + plugins
│   ├── capabilities/         # Permissions
│   └── tauri.conf.json
├── e2e/                      # Playwright specs（sourceMode.ts 预置源码模式）
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

Before committing: `pnpm tsc --noEmit` → `pnpm lint` → `pnpm format` → `pnpm test:run`.

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

Defined in `src-tauri/src/lib.rs`:

| Command          | Parameters            | Returns           | Description                |
| ---------------- | --------------------- | ----------------- | -------------------------- |
| `read_file`      | `path`                | `FileInfo`        | Read file content          |
| `save_file`      | `path, content`       | `SaveResult`      | Write file content         |
| `file_exists`    | `path`                | `bool`            | Check existence            |
| `read_directory` | `ReadDirectoryParams` | `FileTreeItem[]`  | File tree data             |
| `create_file`    | `path`                | `null`            | Create empty file          |
| `create_folder`  | `path`                | `null`            | Create directory           |
| `rename_path`    | `oldPath, newPath`    | `null`            | Rename/move file or folder |
| `delete_path`    | `path`                | `null`            | Delete (folder: recursive) |
| `export_pdf`     | html content, title   | `ExportPdfResult` | Temp HTML → system browser |
| `print_pdf`      | `fileName`            | `ExportPdfResult` | Native print dialog        |
| `rebuild_menu`   | `lang, recentFiles`   | `null`            | Rebuild native menu (i18n / recent files) |
| `set_menu_item_enabled` | `id, enabled`  | `null`            | Native menu item enabled state |
| `set_menu_item_checked` | `id, checked`  | `null`            | Native menu check item state |

Adding a command: implement `#[tauri::command]` in `lib.rs`, register in `generate_handler![]`, invoke via `@tauri-apps/api/core`. Struct fields cross the bridge as camelCase (`#[serde(rename = "isDirectory")]`).

## Keyboard Shortcuts

| Shortcut                         | Action                      | Implementation                    |
| -------------------------------- | --------------------------- | --------------------------------- |
| `Cmd/Ctrl + O / S / Shift+S / N` | Open / Save / Save As / New | 原生菜单（桌面端）/ `useKeyboardShortcuts.ts`（浏览器） |
| `Cmd/Ctrl + /`                   | WYSIWYG ⇄ Source 切换       | `useKeyboardShortcuts.ts`         |
| `Cmd/Ctrl + B / I / K`           | Bold / Italic / Link        | `CodeMirrorEditor.tsx` keymap     |
| `Cmd/Ctrl + 1 / 2 / 3`           | Heading 1 / 2 / 3           | `CodeMirrorEditor.tsx` keymap     |
| `Cmd/Ctrl + Z / Shift+Z`         | Undo / Redo                 | 原生菜单 → editor-undo/redo；CM / Milkdown history |
| `Cmd/Ctrl + F`                   | Find & replace              | 原生菜单 → editor-find → `@codemirror/search` |
| `Cmd/Ctrl + =/+ / - / 0`         | Zoom in / out / reset       | 原生菜单 / `Editor.tsx`           |
| `Cmd/Ctrl + ,`                   | Settings                    | 原生菜单（App/File 菜单）         |
| `Cmd/Ctrl + Shift+B`             | Toggle Sidebar              | 原生菜单（View 菜单）             |
| `Cmd/Ctrl + Alt+1~4`             | WYSIWYG / Source / Split / Preview | 原生菜单（View 菜单 check 项） |
| `Cmd/Ctrl + P`                   | Export PDF                  | 原生菜单 / `Toolbar.tsx`          |
| `Escape`                         | Exit edit mode              | `Editor.tsx`                      |

## Architecture Notes & Gotchas

Read these before touching editor code — details in `docs/implementation-notes.md`:

- **Dual editor cores**: WYSIWYG = Milkdown/ProseMirror（`WysiwygEditor.tsx`），Source/Split = CodeMirror 6（`CodeMirrorEditor.tsx`），都常驻挂载（非激活 hidden）。Markdown 源码是唯一事实来源；两侧事件 handler 与 `canUndo/canRedo` 写入都按 `viewMode` 门控
- **Milkdown**: `@milkdown/kit` 必须子路径导入；自定义语法（admonition/PlantUML/本地图片/任务列表 checkbox）全是纯 DOM `$view` nodeview + `$remark` mdast 变换，往返无损有测试锁定
- **Source 模式格式化**: `src/lib/markdownEditing.ts`（纯函数，可单测）；store ↔ CM 文档同步必须防回环（写入前比较当前值）
- **Scroll container refs**: preview/outline scroll code requires the ref on the _scrollable container_ (`overflow-auto` div), not on `.markdown-body`
- **Split scroll sync**: percentage-based, guarded by an `isSyncingScroll` flag + 50ms timeout to prevent infinite loops；编辑器侧滚动容器是 CM 的 `view.scrollDOM`
- **Cross-component events**: `CustomEvent` bus on `window` — `editor-format` / `editor-insert` / `editor-undo` / `editor-redo`（工具栏 → 编辑器），`editor-scroll-to-heading` (outline nav), `editor-request-html` (PDF export), `editor-find` (原生菜单 Find)
- **原生菜单事件流**: `src-tauri/src/menu.rs` 构建系统菜单（macOS App/File/Edit/View/Window；Windows/Linux 适配）→ `on_menu_event` emit `native-menu-event` → `src/lib/nativeMenu.ts` `handleMenuAction` 分发。带 accelerator 的键在桌面端被 OS 拦截，webview 收不到 keydown —— 桌面端快捷键由菜单事件驱动，`useKeyboardShortcuts` 仅浏览器 dev/E2E 生效，互不重迭；菜单 check/enabled 态与语言/最近文件由 store 订阅经 `set_menu_item_checked/enabled`/`rebuild_menu` 同步（**`Menu::get` 只查顶层项，子菜单内的项必须走 lib.rs 的 `find_menu_item` 递归查找；muda CheckMenuItem 点击会原生自动翻转勾选，最终态以同步为准；菜单重建后 check/enabled 回到构建默认值，必须重新同步一轮**）；Edit 的 Undo/Redo 用自定义项（系统级 undo 会绕过 CM/Milkdown history）
- **Task list checkboxes**: with `dangerouslySetInnerHTML`, never read `checkbox.checked` — use the `data-task-status` attribute and re-sync DOM state in a `useEffect` after each render
- **Windows paths**: normalize `\` → `/` before any path math (`imageUtils.getRelativePath`, `parser.resolveRelativePath`, Editor `baseDir`)
- **External links**: intercept clicks in preview, `e.preventDefault()`, open via `@tauri-apps/plugin-shell` (requires `shell:default` capability)
- **Window title**: shows `文件名 ● - VividMark` (● = unsaved), set via `@tauri-apps/api/window`
- **主题约定**: globals.css 顶部 `@custom-variant dark (&:where(.dark, .dark *))` — `dark:` 变体跟随应用内 `.dark` class（挂 documentElement），不再是系统媒体查询；颜色一律走 CSS 变量（`--hover-bg`/`--active-bg`/`--color-text-muted` 等，:root 与 .dark 双定义），新组件禁止 Tailwind 灰色硬编码
- **菜单原语**: 下拉/右键菜单统一用 `src/components/Menu/`（Dropdown / ContextMenu / MenuPanel），禁止再复制 outside-click 模式；ContextMenu 的 `onClose` 必须 useCallback 稳定化
- **macOS 融合标题栏**: tauri.conf.json `titleBarStyle: Overlay` + `hiddenTitle`（仅 macOS 生效）；App 给 documentElement 加 `is-macos` class（判定走 `src/lib/platform.ts`）；Toolbar 根 `data-tauri-drag-region` + macOS 下 `pl-[78px]`（traffic light 预留）+ 自绘居中标题（<760px 隐藏）
- **Logging**: use `createLogger('Module')` from `src/lib/logger.ts` (frontend) and `tauri-plugin-log` (backend); logs at `~/Library/Logs/com.vividmark.app/` on macOS

## Known Issues

- **代码块中英文对齐**: WebView 无法保证全角:半角 = 2:1，ASCII 图混排中英文无法对齐。多种等宽字体方案均无效，建议用 Mermaid/PlantUML 替代（分析见 implementation-notes）
- **PDF 默认文件名**: macOS 打印对话框固定使用 bundle 名 `vividmark.pdf`，需用户手动修改
- **WYSIWYG 已知限制**: wysiwyg 下 Cmd+K / Cmd+1/2/3 未接；表格创建用 `|CxR| ` 语法；admonition 不能在编辑器内新建；代码块无语法高亮（详见 implementation-notes）

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
