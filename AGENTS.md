# VividMark - Agent Guide

**English | [简体中文](AGENTS.zh-CN.md)**

Essential information for AI coding agents working on the VividMark project. Keep this file lean—deep implementation notes live in `docs/implementation-notes.md`, and task tracking lives in `PLAN.md`.

## Project Overview

**VividMark** is a lightweight Markdown editor built with **Tauri 2.0 + React 19 + TypeScript**, providing a Typora-inspired, distraction-free writing experience.

Key features:

- Four view modes: WYSIWYG (default, Milkdown/ProseMirror) / Source / Split / Preview
- CodeMirror 6 source editor: Markdown highlighting, smart list continuation, find & replace
- Real-time Markdown preview (markdown-it + highlight.js)
- Markdown extensions: admonitions (`:::` / `!!!` / `???`—collapsible admonitions are preview/export only), GitHub Alerts (`> [!NOTE]`), footnotes (`[^id]`), typography enhancements (`==` highlight / `^` superscript / `~` subscript / emoji shortcodes), PlantUML (offline local-engine rendering), Mermaid (lazy-loaded offline rendering), task lists, tables, math formulas (KaTeX), and YAML frontmatter
- File operations with native dialogs, auto-save (2s idle), drag & drop, and recent files
- Multi-window (Typora-style SDI): one window per document with smart open routing (focus / reuse / new window)
- Native menubar (File/Edit/Paragraph/Format/View), macOS Dock menu, and file associations (Open With)
- Sidebar with outline navigation and a resizable file tree; status bar (sidebar toggle, word count, cursor, view mode, zoom)
- i18n (en / zh-CN), dark mode, 50–200% zoom, and PDF export
- Export an opened folder as a deployable static site (built-in generator with no external dependencies; MkDocs config-aware—`nav`/`docs_dir` from `mkdocs.yml` drive export)

## Documentation Map

| File | Content |
| --- | --- |
| `PLAN.md` (+ `.zh-CN`) | Development plan and task progress (the only task board; do not duplicate it here) |
| `docs/implementation-notes.md` (+ `.zh-CN`) | Implementation knowledge base: known issues, architecture, Tauri command/shortcut tables, release process, and Git rules |
| `docs/session-log.md` | Historical development log (session records archived from `PLAN.md`) |
| `docs/REQUIREMENTS.md` | Requirements document |
| `docs/DESIGN_SYSTEM.md` (+ `.zh-CN`) | UI design system: tokens, shared components, themes, and usage rules |
| `docs/ux-improvement-plan.md` | Typora UX gap analysis and P0–P4 improvement plan |
| `docs/wysiwyg-research.md` + `docs/wysiwyg-implementation-plan.md` | WYSIWYG research and implementation plan (custom-built route, superseded by P2) |
| `docs/typst-offline-plan.md` | Typst offline support plan (paused; moved toward a standalone product on 2026-08-12) |
| `docs/typst-standalone-editor-plan.md` | Standalone Typst editor research (not approved; product direction separate from VividMark) |
| `docs/word-export-plan.md` | Word (docx) export feasibility and implementation plan (pending review; pandoc route) |
| `docs/site-export-config-plan.md` | MkDocs/VuePress config-aware site export plan (completed: MkDocs nav/docs_dir/exclude_docs/`!!!`; VuePress public/title best-effort) |
| `docs/syntax-extensions-plan.md` | Markdown extension inventory and plan (batches 1–5 completed: Alerts/footnotes/frontmatter/Mermaid/typography) |
| `docs/tauri-evaluation.md` | Tauri framework evaluation based on this project's production experience (strengths, costs, and ecosystem analysis for external readers) |
| `docs/drag-drop-testing.md` | Drag-and-drop test strategy and manual acceptance checklist |
| `CONTRIBUTING.md` (+ `.zh-CN`) | Contribution guide: environment setup, pre-commit checks, PR process, and AI-assisted contribution policy |
| `linglong/README.md` | Linglong packaging and pitfalls (older systems such as UOS 20; build entry `linglong.yaml` + `linglong/build.sh`) |

## Technology Stack

| Category | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite 7 |
| Desktop | Tauri 2.0 (Rust) |
| Editor | CodeMirror 6 (Source) + Milkdown 7 (WYSIWYG, ProseMirror) |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 (persisted user preferences) |
| i18n | i18next + react-i18next |
| Markdown | markdown-it + highlight.js + KaTeX |
| Unit Tests | Vitest + React Testing Library |
| E2E Tests | Playwright |
| Lint/Format | ESLint (flat config) + Prettier |

## Project Structure

```
vividmark/
├── src/                      # React frontend
│   ├── components/           # Editor/ Sidebar/ Toolbar/ FileTree/ StatusBar/
│   │                         # ui/ (Button/TextField/Modal), Menu/ primitives, Settings/
│   ├── hooks/                # useAutoSave, useFileDragDrop, useKeyboardShortcuts,
│   │                         # useResizable, useDebouncedValue, useContextMenu
│   ├── stores/editorStore.ts # Zustand main store
│   ├── lib/                  # markdown/, markdownEditing, textStats, plantuml, mermaid, imageSrc
│   │                         # fileOps, logger, imageUtils, theme, platform
│   │                         # editorActions (shared menu/toolbar actions), openWith, ...
│   ├── i18n/                 # i18next config + locales/{en,zh-CN}.json
│   ├── styles/               # tokens.css (design tokens), globals.css (global/domain styles)
│   ├── test/                 # Vitest setup + Tauri mocks
│   └── App.tsx / main.tsx
├── src-tauri/                # Rust backend
│   ├── src/lib.rs            # Tauri commands + plugins + RunEvent::Opened
│   ├── src/menu.rs           # Native menubar (Paragraph/Format/View, etc.)
│   ├── src/dock_menu.rs      # macOS Dock context menu (objc2, macOS only)
│   ├── capabilities/         # Permissions
│   └── tauri.conf.json
├── e2e/                      # Playwright specs (sourceMode.ts presets Source mode)
├── scripts/                  # Utility scripts (take-screenshots.mjs needs the dev server)
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

Before committing: `pnpm tsc -b` (**not** `tsc --noEmit`—the root tsconfig uses solution-style references, and the latter checks no files) → `pnpm lint` → `pnpm format` → `pnpm test:run`.

## Code Style

- **TS/JS**: 2-space indent, no semicolons, single quotes (double in JSX), 100-char width, ES5 trailing commas (see `.prettierrc`)
- **Rust**: 4-space indent, `snake_case`
- **Naming**: Components `PascalCase.tsx`, hooks `use*.ts`, utilities `camelCase.ts`, tests co-located in `__tests__/` or `*.test.ts`
- **Import order**: React → third-party → `@/` absolute → relative → type imports
- **Styling**: Follow `docs/DESIGN_SYSTEM.md`. Tokens live in `styles/tokens.css`; new UI prefers semantic Tailwind classes and `components/ui/` (Button/TextField/Modal). Hardcoded colors and static inline font sizes are prohibited (`designGuard.test.ts` enforces this). Dark mode follows the `.dark` class; rendered Markdown uses `.markdown-body`.

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
- **Non-persisted**: `content`, `filePath`/`fileName`, `isDirty`, `isDarkMode` (derived), `openedFolder`, `cursorLine`/`cursorCol`, `activeHeadingIndex`, `isSettingsOpen`

## Internationalization (i18n)

- Languages: `en` (default), `zh-CN`; locales in `src/i18n/locales/*.json`
- Use `const { t } = useTranslation()` in components; support `{{var}}` interpolation
- Adding a language: create locale JSON and register it in `src/i18n/index.ts` (`availableLanguages` + `resources`)
- The language selector uses text labels (`EN` / `中`), not emoji flags (Windows rendering)
- **Doc sync convention**: `README.md` ↔ `README.zh-CN.md`, `PLAN.md` ↔ `PLAN.zh-CN.md`, `AGENTS.md` ↔ `AGENTS.zh-CN.md`, `docs/implementation-notes.md` ↔ `docs/implementation-notes.zh-CN.md`, `docs/DESIGN_SYSTEM.md` ↔ `docs/DESIGN_SYSTEM.zh-CN.md`, and `docs/index.html` ↔ `docs/index.zh-CN.html` must be updated together

## Tauri Commands (Rust Backend)

Commands are defined in `src-tauri/src/lib.rs` (PDF in `pdf.rs`, site export in `site_export.rs`, multi-window routing in `window_router.rs`, and window titles in `titlebar.rs`). **See the “Tauri Commands” table in `docs/implementation-notes.md` for all command parameters and return values.**

To add a command: implement `#[tauri::command]` → register it in `generate_handler![]` → invoke it from the frontend through `@tauri-apps/api/core`. Struct fields cross the bridge as camelCase (`#[serde(rename = "isDirectory")]`).

## Keyboard Shortcuts

**See the complete shortcut table in `docs/implementation-notes.md`.** Core convention: on macOS/Linux desktop, keys with accelerators are intercepted by the OS (the webview receives no keydown), so native menu events drive those shortcuts. **On Windows desktop (no native menubar) and in browser dev/E2E, `useKeyboardShortcuts.ts` handles the full set.** Its key table aligns with `menu.rs`; keys already handled by an editor keymap are skipped through the `e.defaultPrevented` guard.

## Architecture Notes & Gotchas

Read these before touching editor code. Each item retains only the core constraint; expanded details live in `docs/implementation-notes.md` (“notes” below).

- **Dual editor cores**: WYSIWYG = Milkdown/ProseMirror (`WysiwygEditor.tsx`); Source/Split = CodeMirror 6 (`CodeMirrorEditor.tsx`). Both stay mounted (inactive editor hidden). Markdown source is the single source of truth; event handlers and `canUndo`/`canRedo` writes on both sides are gated by `viewMode`.
- **Milkdown**: `@milkdown/kit` must use subpath imports. Custom syntax (admonition/PlantUML/local images/task lists/math/frontmatter) uses pure DOM `$view` nodeviews + `$remark` mdast transforms, with lossless round-trip tests. The commonmark preset excludes `remark-preserve-empty-line` (empty paragraph = ordinary blank line; existing `<br />` source lines still parse as preserved html nodes). **`$remark` options default to `{}` and pass directly into `.use()`**—remark plugins that validate options require an explicit third argument (for example, frontmatter passes `'yaml'`; see notes).
- **Math (KaTeX)**: Implemented on both sides (custom rule in `src/lib/markdown/mathPlugin.ts` for markdown-it; `mathPlugin.ts` + `mathView.ts` with click-to-edit for WYSIWYG). **Syntax rules strictly align with micromark-extension-math 3.x** (block math uses multiline fences only; single-line `$$x$$` is inline math). Any mismatch causes mode-switch flicker.
- **GitHub Alerts (`> [!NOTE]`)**: Both sides share `matchAlertMarkerLine` from `src/lib/markdown/githubAlert.ts` (five types only, case-insensitive; **must tolerate our serializer's output**, including `\[` escapes and trailing `\`). Preview `githubAlertPlugin.ts` is a core-rule blockquote-token postprocessor (rewrites to three-part admonition HTML and strips the marker). WYSIWYG `githubAlertDecorations.ts` uses **pure PM Decorations** (zero schema changes: injects `admonition <type>` classes into blockquote to reuse colors; marker line remains visible/editable). Unknown types, `+-` fold markers, or same-line trailing text degrade to ordinary quotes.
- **Footnotes (`[^id]`)**: WYSIWYG adds zero schema nodes—Milkdown's `gfm` preset provides `footnote_reference`/`footnote_definition`, and remark-gfm handles parsing/serialization (lossless round trips are test-locked). Numbering is pure decoration (`footnoteDecorations.ts` injects `data-footnote-number` in first-reference order; CSS replaces labels with `[N]`; dangling references are unnumbered and display their labels). Preview uses `markdown-it-footnote` (caption override always `[N]`; unreferenced definitions are not rendered, matching GitHub). Preview `#fn` anchor clicks use in-page `scrollIntoView`, never external navigation.
- **Typography (`==`/`^`/`~`/emoji)**: Preview uses `markdown-it-mark`/`sup`/`sub`/`emoji` (chained `.use()` in `parser.ts`). WYSIWYG implements three parts in `typographyPlugin.ts`: a pairedDelimiter micromark extension factory (fixed-length paired delimiters; flanking rules match GFM strikethrough), mdast fromMarkdown/toMarkdown (mark/superscript/subscript nodes are inline containers; PM marks, not nodes), and input rules. **The gfm preset excludes `remarkGFMPlugin` and `strikethroughInputRule`** (reference-identity filtering): the former is re-registered with `{ singleTilde: false }` (single `~` belongs to subscript; `~~` remains deletion), and the latter is replaced by a `~~`-only rule (the original converts single `~` input to strikethrough and serializes it as `~~`). Serialization escapes: `=` escapes only the second of a pair (`a = b` stays untouched), `^` is always escaped, and `~` follows gfm strikethrough's existing unsafe rules. Overlong delimiters (`===`/`^^`) remain literal in WYSIWYG while preview parses the inner pair (pathological syntax documented in examples). Emoji is preview-only by decision; WYSIWYG keeps literal shortcodes with zero modeling.
- **PlantUML local rendering (offline)**: `@plantuml/core` (TeaVM) is copied to `vendor/plantuml/` (not committed) and lazy-loaded. **The engine shares internal state and must render serially** (single entry `src/lib/plantuml.ts`: Promise queue + cache + inflight deduplication; failures fall back to online img). markdown-it emits only `data-plantuml-src` placeholders (after masking fenced/inline code regions). **Progressive preview rendering effect deps must include `viewMode`**. Export uses `parseMarkdownAsync { inlinePlantUml: true }` to inline SVG. jsdom has no canvas—unit tests inject a fake engine; real smoke coverage is `e2e/plantuml.spec.ts`.
- **Mermaid (offline)**: The official `mermaid` package is lazy-loaded through dynamic-import chunking (`src/lib/mermaid.ts`, with the same serial queue/cache/inflight model as PlantUML—global `initialize` configuration + `render` in a temporary body-attached container are not concurrency-safe). Reinitialize and rerender when dark mode changes. **No online fallback**—failures (usually syntax errors) consistently show source in `pre.mermaid-error`. Only ` ```mermaid ` fenced blocks are supported (no inline syntax, no masking needed); placeholders/progressive rendering/export inlining (`inlineMermaid`) share PlantUML's pipeline. **Diagram placeholders are not wrapped in pre/code** (the fence rule is overridden—pre's `!important` monospace font leaks into SVG foreignObject, disagreeing with Mermaid's measurement font and clipping text). Sequence `sequence.height` is tightened to 46, and **`dominant-baseline="central"` text is rewritten to absolute y offsets** (WebKit does not support this property; WKWebView text sits ~0.35em high—see notes). gitGraph branch-label `tspan dy="1em"` is rewritten to absolute y (WKWebView resolves em-based dy away from font-size, shifting text down—see notes). WYSIWYG uses plantUmlCodeBlockView to dispatch dual panes by language (a kind change makes `update()` return false to rebuild). jsdom injects a fake renderer; real smoke coverage is `e2e/mermaid.spec.ts`.
- **React 19 preview innerHTML resets**: `dangerouslySetInnerHTML` compares by **object identity**, and setProp unconditionally rewrites innerHTML—the preview prop must be memoized (`previewHtmlProp` in Editor.tsx), or unrelated rerenders such as zoom reset progressively rendered diagram DOM to placeholders (see “React 19” in notes).
- **Source-mode formatting**: `src/lib/markdownEditing.ts` contains pure, unit-testable functions. Store ↔ CM document synchronization must prevent feedback loops (compare against the current value before writing).
- **File watching**: Rust `file_watch.rs` watches the **parent directory** per window and filters the target file (notify, 300ms debounce, released on window Destroyed). Frontend `src/lib/fileWatcher.ts` routes clean silent reload / dirty conflict dialog (auto-save pauses while unresolved) / one deletion notice (reset after save recreates the file). Echoes from our saves are suppressed by comparing disk content with `lastKnownContent` (`markFileContentKnown` instrumentation in fileOps open/save).
- **Scroll container refs**: preview/outline scroll code requires the ref on the _scrollable container_ (`overflow-auto` div), not on `.markdown-body`.
- **Split scroll sync**: percentage-based, guarded by an `isSyncingScroll` flag + 50ms timeout to prevent infinite loops; the editor-side scroll container is CM's `view.scrollDOM`.
- **Cross-component events**: `CustomEvent` bus on `window`—`editor-format` / `editor-insert` / `editor-undo` / `editor-redo` (menu/toolbar → editor); `editor-cut` / `editor-copy` / `editor-paste` / `editor-select-all` (menu clipboard actions, dispatched by `nativeMenu.ts` and listened to by all three editors); `editor-scroll-to-heading` (outline nav); `editor-export-pdf` (PDF export); `editor-find` (native Find); `app-open-dialog` (native menu → Toolbar dialog); `app-open-image-viewer` (fullscreen diagram/image viewer, detail `{ html }`). `file-open-request` (file-association open) is not a CustomEvent—it is a Tauri event (Rust `window.emit` → `openWith.ts` listen, same route as `prefs-sync`).
- **WYSIWYG Enter model**: In a normal paragraph, Enter = inline soft break and Enter×2 = new paragraph; list/heading/code-block behavior is unchanged (`wysiwygEnterCommand`). CM's defaultKeymap removes `Mod-/` (toggleComment conflicts with mode switching). Chinese IME (WKWebView) phantom nodes and swallowed Enter have a dedicated plugin chain (see “Chinese IME composition” in notes).
- **Multi-window (Typora-style SDI)**: Each document gets an independent window (independent webview/JS context). Core `src-tauri/src/window_router.rs`: `WINDOW_STATES` registry (frontend reports through `report_window_state`) + `LAST_FOCUSED` + startup open queue. Open routing = already open → focus / clean empty window → reuse / otherwise create (pending deduplication). **Windows window-creation commands must use `#[tauri::command(async)]`** (synchronous commands run on the main thread; calling build() there after the event loop starts self-deadlocks—the 0.9.0 “new window freeze” hotfix; macOS/Linux keep main-thread creation, with workers dispatching through `run_on_main_thread`, and setup records the main-thread id for routing). **Cross-window preference sync uses `prefs-sync` Tauri event broadcasts—not localStorage storage events** (macOS WKWebView windows have independent localStorage). Menu/Dock events are targeted through `emit_to_focused`; capabilities require `windows: ["*"]`; hidden PDF window labels are excluded from routing.
- **Native menu event flow (macOS/Linux only; Windows has no native menubar)**: `menu.rs` builds → `on_menu_event` emits `native-menu-event` through `emit_to_focused` → `nativeMenu.ts handleMenuAction` dispatches (all macOS/Linux desktop shortcuts use this route; see “Keyboard Shortcuts”). IDs share the context-menu convention (`format:<FormatType>` / `insert:*`). Finding submenu items must recurse through lib.rs `find_menu_item` (`Menu::get` checks only the top level). CheckMenuItem clicks natively toggle their checks; synchronized state is authoritative. **After menu rebuild, check/enabled return to construction defaults and must be resynchronized**. **Focus must also trigger rebuildMenu** (startup isFocused may be false, skipping initial rebuild and leaving labels in the construction-time language). On rebuildMenu failure, reset the deduplication key to allow retry. Edit Undo/Redo use custom items (system undo would bypass editor history). **muda GTK predefined-item allowlist**: the Linux backend permits only `Separator`, four clipboard items, and `About`; `Minimize`/`Maximize`/`Quit`/`CloseWindow`/`Fullscreen` are silently dropped—always use custom items on Linux (`window:minimize`/`window:maximize`/`view:fullscreen`/`file:exit` → `quit_app` command closes each window through dirty confirmation). **Menubar text shifting right**: muda packs a 16px empty GtkImage placeholder into each item, pushing text 22px right; `strip_menubar_icon_placeholders()` (lib.rs) removes empty images and is called from setup, rebuild_menu, and new-window creation.
- **macOS Dock context menu**: `dock_menu.rs` (macOS only) uses objc2 to add `class_addMethod(applicationDockMenu:)` to tao AppDelegate. Actions reuse the `native-menu-event` channel (file-new/file-open/open-recent:\*/clear-recent). **Tao upgrades require regression verification**.
- **File associations (Open With)**: `bundle.fileAssociations` in `tauri.conf.json` (works only after packaged installation; LaunchServices registration). macOS `RunEvent::Opened` → `route_open_paths` window routing → `src/lib/openWith.ts` (startup backlog is retrieved through `take_startup_open_files`—**must pass this window's label**; None clears every window's queue). **Cold-start Opened may arrive before config window creation/frontend reports—queue everything in main's startup queue before `RunEvent::Ready` instead of creating windows** (APP_READY flag; otherwise an extra welcome window always appears). Windows/Linux parse startup argv through setup's `collect_argv_files()` into the same route (cold start queues into main). Single-instance handling is not implemented (double-clicking while running starts a second process; future item).
- **Task list checkboxes**: with `dangerouslySetInnerHTML`, never read `checkbox.checked`—use the `data-task-status` attribute and resync DOM state in a `useEffect` after each render.
- **Windows paths**: normalize `\` → `/` before any path math (`imageUtils.getRelativePath`, `imageSrc.resolveRelativePath`, Editor `baseDir`).
- **External links**: intercept clicks in preview, call `e.preventDefault()`, and open through `@tauri-apps/plugin-shell` (requires `shell:default` capability).
- **Window title**: Typora-style `filename ●` (● = unsaved). **Frontend must never call setTitle directly**—use the `set_window_title` command (titlebar.rs, which rearranges traffic lights after setting the title). Window permissions (`core:window:allow-set-title` / `allow-start-dragging` / `allow-destroy`) are non-default in Tauri 2.10+ and must be granted explicitly in capabilities, or titles fail, dragging fails, and **windows cannot close**.
- **Theme convention**: `tokens.css` defines `@custom-variant dark (&:where(.dark, .dark *))`—`dark:` follows the application's `.dark` class on documentElement, not the system media query. Colors always use CSS variables (`--hover-bg`/`--active-bg`/`--color-text-muted`, etc., defined under both :root and .dark); new components must not hardcode Tailwind grays.
- **Menu primitives**: Dropdown/context menu/menubar consistently use `src/components/Menu/` (Dropdown / ContextMenu / MenuPanel / MenuBar); do not copy the outside-click pattern again. ContextMenu `onClose` must be stabilized with useCallback. MenuPanel supports one submenu level (`MenuSubmenuItem.children`, flips left at the right edge and upward at the bottom). **Primitives have no keyboard navigation except Escape**; Alt mnemonics and arrow-key navigation are a unified future item.
- **Editor context menus**: Source/Preview/WYSIWYG are all covered, with Typora-aligned structure (clipboard group + Paragraph▸/Format▸/Insert▸ submenus). Menu construction is a pure function (`src/lib/contextMenu.ts`); actions dispatch by id prefix (`format:*` → editor-format; clipboard uses `src/lib/clipboard.ts`; WYSIWYG contextual actions live in `wysiwygContextMenu.ts`). **WebKit context-click selection theft**: when the click lands outside the selection, contextmenu collapses the selection and `getSelection().collapse(domAtPos)` restores DOM selection; when inside, candidates restore from mousedown snapshot/current/selectionchange history (validated against doc), with a selection guard locked while the menu is open (see notes). **Clipboard permissions**: `clipboard-manager:default` has been empty since 2.3.2; capabilities must explicitly grant `allow-read-text`/`allow-write-text`, or desktop copy/paste is silently denied by ACL.
- **macOS integrated titlebar**: `titleBarStyle: Overlay` + `hiddenTitle` (macOS only). `trafficLightPosition {x:12, y:25.5}` vertically centers traffic lights in the 48px toolbar. The `is-macos` class comes from `src/lib/platform.ts`. Toolbar root and left/right group containers all carry `data-tauri-drag-region` (Tauri drag.js checks only `e.target`'s own attributes), plus `pl-[78px]` on macOS and a custom centered title (hidden below 760px). **setTitle resets traffic-light position** (therefore titles must use `set_window_title`; see “Window title”).
- **Linux/Windows borderless custom titlebar**: Decoration removal differs by platform—Linux main window (lib.rs setup) and new document windows (window_router) use `decorations(false)` at creation; **Windows always calls `set_decorations(false)` after successful creation** (matching the verified main-window form)—because system titlebar + menubar + toolbar stack too thickly. Frontend Toolbar doubles as titlebar: custom filename + `WindowControls.tsx` (minimize/maximize toggle/close; close uses `win.close()` on the same dirty-confirmation path). Drag/double-click maximize use tauri drag.js with zero new code. Edge resizing uses `WindowResizeHandles.tsx` (4px edge / 12px corner hit areas → `startResizeDragging`, hidden while maximized; `ResizeDirection` is not exported by api 2.10 and is replicated locally). Gated by `isLinuxDesktop()`/`isWindowsDesktop()` (platform.ts). Capabilities require `allow-minimize`/`allow-close`/`allow-toggle-maximize`/`allow-internal-toggle-maximize`/`allow-is-maximized`/`allow-start-resize-dragging`/`allow-set-fullscreen`/`allow-is-fullscreen` (the last two support `view:fullscreen`). **Platform difference: Linux retains the GTK menubar** (shortcuts rely on its accelerators; the GTK backend also has empty-icon-placeholder/deepin-padding fixes—see notes); **Windows removes the menubar too** (setup does not set_menu; rebuild_menu is a no-op), with menus and shortcuts fully implemented in the frontend, as below.
- **Windows custom menubar (MenuBar)**: `src/components/Menu/MenuBar.tsx` sits in Toolbar's left group (VS Code-style single line: menus + title + MoreMenu + window controls), **and also renders in browser dev/E2E** (`!isMacOSDesktop() && !isLinuxDesktop()`; directly tested by `e2e/menubar.spec.ts`). Menu construction is a pure function in `src/lib/menuBar.ts` (structure aligns with menu.rs Windows layout; IDs match native menus; checked/disabled read the store reactively—**no** imperative set_menu_item_checked synchronization). Clicks still use `handleMenuAction`. Frontend replacements for native predefined items: Cut/Copy/Paste/SelectAll → `editor-cut/copy/paste/select-all` events (each of the three editors implements them, reusing context-menu logic); About → `AboutDialog.tsx` (store `isAboutOpen`); Minimize/Maximize/Fullscreen/Exit → reuse Linux's `window:*`/`view:fullscreen`/`file:exit` IDs. `initNativeMenu` is skipped entirely on Windows (only the handleMenuAction export remains).
- **Logging**: use `createLogger('Module')` from `src/lib/logger.ts` (frontend) and `tauri-plugin-log` (backend); logs live at `~/Library/Logs/com.vividmark.app/` on macOS.
- **Export as website (static site package)**: Menu/MoreMenu `export-site` (gated by `openedFolder`) → `exportSite.ts` → pure logic in `siteGenerator.ts` (mirrors directory structure, maps README/index to index.html in their directory, sorts numeric prefixes and strips them from display, rewrites `.md` cross-links to `.html`) → Rust `export_site` batch disk writes. Page shell is `siteTemplate.ts` (`.dark` toggle, `.nojekyll`). **Config awareness** (`siteConfig.ts`): flavor mkdocs > vuepress > plain; `nav`/`docs_dir` from `mkdocs.yml` drive navigation and scope; nav is a curated allowlist (unlisted pages are not appended). VuePress is best-effort: `.vuepress/public/*` mirrors to site root (public overrides same-name assets; page-name collisions are dropped), and config title is regex-extracted as the site name (hidden-directory checkpoint: `read_directory` skipping applies only to listed children; directly reading `.vuepress/public` works; `file_exists` returns true for files or directories—once recognized only is_file and broke all directory detection, now fixed). Critical: rendering must use `parseMarkdownAsync(content, { preserveImages: true, inlinePlantUml: true })`, or relative images become dead asset:// links and UML requires network access.
- **Direct-save PDF pipeline**: `editor-export-pdf` event → `exportPdf.ts` builds standalone HTML → `export_pdf_file` (hidden `vividmark-pdf://` window renders, 15s timeout fallback) → macOS `NSPrintOperation(SaveJob)` / Windows `PrintToPdf` silently write the file. **macOS requires sharedPrintInfo copy + canSpawnSeparateThread(true) + runOperationModalForWindow** (a fresh NSPrintInfo + run() causes infinite pagination). PDF bookmark outlines are rebuilt with PDFKit post-processing on macOS. Linux falls back to the `print_pdf` print dialog.

## Known Issues

- **CJK/Latin alignment in code blocks**: WebView cannot guarantee full-width:half-width = 2:1, so ASCII diagrams mixing CJK and Latin text cannot align. Multiple monospace-font approaches have failed; use Mermaid/PlantUML instead (analysis in implementation-notes).
- **Direct-save PDF platform differences**: macOS (NSPrintOperation SaveJob) and Windows (WebView2 PrintToPdf) support silent saving; Linux (webkit2gtk has no print_to_pdf binding) falls back to the system print dialog.
- **WYSIWYG limitations**: tables are created with `|CxR| ` syntax; existing admonition type/title edits require Source mode; slash menu, floating format toolbar, and WYSIWYG find/replace are not connected (see implementation-notes).

## CI/CD & Release

- `.github/workflows/test.yml`: lint + typecheck + unit tests (coverage → Codecov)
- `.github/workflows/release.yml`: push `v*` tag → multi-platform build (macOS/Windows/Linux) → GitHub Release. The `build-linglong` job (`ubuntu-24.04-arm` runner) builds a Linglong arm64 `.layer` with each tag and attaches it directly to the Release (manual dispatch only uploads an artifact; see `linglong/README.md`).
- `.github/workflows/pages.yml`: `docs/` → GitHub Pages
- Version numbers must stay in sync: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (`linglong.yaml` is rewritten automatically from the tag in CI; align it manually before local builds).
- macOS Release uses Developer ID Application signing + Apple notarization + DMG stapling; unsigned Windows builds still show a SmartScreen warning.

## Working Agreements

- Keep the single task board in the `PLAN.md` / `PLAN.zh-CN.md` pair; do not maintain a task board in AGENTS.md.
- Write implementation details and pitfalls to the `docs/implementation-notes.md` / `.zh-CN.md` pair; AGENTS.md retains only concise guidance.
- When changing any convention documented here (commands, structure, workflows), update this file to match.
- Update `README.md` and `README.zh-CN.md` for user-visible feature changes.
- For new syntax/rendering capabilities, add an example under `examples/` (kebab-case, following `math-formulas.md` / `plantuml-diagrams.md`; cover every variant and edge case, doubling as a manual acceptance fixture).
- Write commit messages in English (Conventional Commits prefix + concise English summary).
- AI-assisted commits append a model trailer at the end of the commit message (`Model: <model name>`, e.g. `Model: Kimi K3 max`), using the model actually used for that commit; purely human commits add no trailer.
