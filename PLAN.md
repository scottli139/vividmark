# VividMark Development Plan

**English | [简体中文](PLAN.zh-CN.md)**

> A Typora-inspired WYSIWYG Markdown editor

## Project Information

- **Project**: VividMark
- **Stack**: Tauri 2.0 + React + TypeScript
- **Repository**: https://github.com/scottli139/vividmark

---

## Development Progress

### Phase 1: Foundation ✅ (Completed)

- [x] Project initialization (Tauri + React + Vite)
- [x] Tailwind CSS configuration
- [x] Zustand state management
- [x] Base layout (Toolbar + Sidebar + Editor)
- [x] Dark-mode toggle
- [x] Development environment verification

### Phase 2: Core Editor ✅ (Completed)

- [x] Markdown parsing (markdown-it)
- [x] Block-level rendering components
- [x] Block-level editing (click to edit, render on blur)
- [x] Smoother block transitions (less flicker)
- [x] Inline element editing (bold, italic, links)
- [x] Code-block syntax highlighting

### Phase 3: File Operations ✅ (Completed)

- [x] Rust backend file read/write commands
- [x] File dialog plugin integration
- [x] Toolbar file actions
- [x] Keyboard shortcuts (Cmd+O, Cmd+S, Cmd+N)
- [x] Drag-and-drop file opening
- [x] Recent-file list
- [x] Auto-save

### Phase 4: Editing Enhancements ✅ (Core Features Completed)

- [x] **Editing-mode refactor** (Source/Preview/Split)
  - Replaced block editing with continuous-document editing
  - Source: edit Markdown source directly
  - Preview: read-only preview
  - Split: source on the left, preview on the right, synchronized scrolling
- [x] Shortcut toolbar (Bold, Italic, Link, etc.)
- [x] **Image insertion and preview** ✅
  - Insert local images from the toolbar
  - Automatically copy images to `./assets/`
  - Tauri asset-protocol preview + base64 fallback
- [x] **Undo/redo stack** ✅ - implemented and fixed
  - Stack-based history management
  - Cmd+Z / Cmd+Shift+Z support
  - [x] Fixed undo/redo bug (getter functions retrieve current content)
- [x] **MkDocs extension syntax** ✅
  - Admonitions: `::: tip`, `::: warning`, `::: info`, `::: note`, `::: danger`, `::: success`
  - PlantUML diagrams: `@startuml...@enduml` and ` ```plantuml ``` ` code blocks
  - Custom titles (for example, `::: tip Note`)
  - Local PlantUML engine renders SVG offline (falls back to the online service on failure; see Phase 13 P3)
- [x] **Markdown extension batches 1–5** ✅ (2026-08-14–18)—five GitHub Alerts (`> [!NOTE]`), footnotes (`[^id]`), YAML frontmatter, Mermaid, and typography (`==` highlight, `^` superscript, `~` subscript, emoji shortcodes); implemented in both editors with lossless round-trip tests. Plan: `docs/syntax-extensions-plan.md`; completion records: `docs/session-log.md`
- [x] **Table editing** ✅ - visual Markdown-table editing with an insertion dialog and custom row/column counts
- [x] **Internationalization** ✅ - Simplified Chinese and English (extensible)
- [x] **Math formulas (KaTeX)** ✅ - inline `$...$` and block `$$` fences; KaTeX rendering, click-to-edit in WYSIWYG, lossless round trips, and inlined fonts in PDF export
- [x] **Task lists (checkboxes)** ✅ - `- [ ]` and `- [x]`, clickable state toggles, and a toolbar task-list button
- [x] **WYSIWYG Phase 1** ✅ - all four modes complete (WYSIWYG/Source/Preview/Split), WYSIWYG by default
- [x] **Toolbar refinement** ✅ - streamlined buttons, heading dropdown, Insert/Format dropdowns, and Windows-compatible language labels
- [x] ~~WYSIWYG Phase 2 - bidirectional synchronization core~~ (the custom contenteditable route was superseded by the Phase 13 P2 Milkdown route)

### Phase 5: File Management ✅ (Completed)

- [x] **Sidebar file tree** ✅ - open folders, recursive expansion, Markdown filtering, and draggable resizing
- [x] **Folder opening** ✅ - integrated into the file tree
- [x] Outline enhancements (click to navigate) ✅
- [x] Multi-window (Typora-style SDI: one window per document; replaced the original multi-tab plan on 2026-08-13 and landed the same day: window registry + open routing (focus/reuse/new) + focus-targeted menu events + cross-window preference sync + dirty confirmation on close; session restore and Windows/Linux single-instance handling deferred to phase 2)
- [x] File watching (automatic reload) ✅ (2026-08-18: per-window notify watcher with clean/dirty routing—silent clean reload / dirty conflict dialog (auto-save pauses while unresolved) / deletion notice and recreation; echo suppression compares lastKnownContent)

### Phase 6: Advanced Features (In Progress)

- [ ] Theme system (CSS theme switching) - light/dark/system completed (Phase 13 P3); CSS theme packages not implemented
- [ ] Custom theme editor
- [x] **PDF export** ✅ - export Markdown to PDF (hidden-window rendering + native silent disk writes on macOS/Windows; Linux falls back to the system print dialog)
- [ ] HTML export
- [ ] Word export (see `docs/word-export-plan.md`; the pandoc route has passed PoC verification)
- [x] Config-aware site export ✅ (P1 MkDocs core ✅ 2026-08-14: flavor detection / docs_dir scoping / nav allowlist / frontmatter; P2 ✅ 2026-08-17: lossless `!!!` round trips in both editors + exclude_docs; P3 ✅ 2026-08-17: VuePress best-effort—mirror `.vuepress/public` to the site root + extract config title; see `docs/site-export-config-plan.md`)
- [x] Find and replace ✅ (Source/Split, Cmd+F; not connected in WYSIWYG—see “Next Actions”)

### Phase 7: Polish and Optimization (In Progress)

- [ ] Performance optimization (large-file handling)
- [x] Native menu integration ✅ (Paragraph/Format menus completed 2026-08-07; see Phase 13 P5)
- [ ] System tray
- [ ] Custom keyboard shortcuts
- [x] Preferences panel ✅ (minimum viable: theme/language/sidebar visibility; see Phase 13 P3)
- [x] Internationalization ✅ (see Phase 4)

### Phase 8: Code Standards ✅ (Completed)

- [x] ESLint rules (flat config, react-hooks, prettier)
- [x] Prettier formatting rules
- [x] TypeScript strict mode (strict, noUnusedLocals, noUnusedParameters enabled)
- [x] `.editorconfig` for consistent editor settings
- [ ] Pre-commit hooks (husky + lint-staged) - optional
- [x] `CONTRIBUTING.md` ✅ (bilingual version completed 2026-08-14)

**Configured files:**

```
.prettierrc      # Prettier configuration
.prettierignore  # Prettier ignore file
eslint.config.js # ESLint flat config
.editorconfig    # Shared editor settings
```

### Phase 9: Automated Testing ✅ (Completed)

- [x] Vitest unit-test setup
- [x] React Testing Library component tests
- [x] Playwright E2E setup
- [x] Test scripts and coverage reports
- [x] **GitHub Actions CI/CD** ✅
  - [x] Automatic TypeScript type checking
  - [x] Automatic ESLint + Prettier checks
  - [x] Automatic unit tests (Vitest)
  - [x] Automatic multi-platform builds ✅ (verified)
  - [x] Automatic releases ✅ (verified)

**Test strategy:**

- Unit tests: hooks, utils, store (co-located `__tests__/`)
- Component tests: Toolbar, Sidebar, FileTree, Menu, etc.
- E2E: `e2e/` (app / context-menu / drag-drop / file-tree / math / mermaid / plantuml / table-editing / task-list / wysiwyg)

### Phase 10: Branding ✅ (Completed)

- [x] Application logo
  - Scalable SVG vector design
  - Minimal modern style + blue gradient
  - Core element: Markdown # symbol
- [x] Icon files (`src-tauri/icons/`: all PNG sizes + icon.icns + icon.ico + Windows Store sizes)
- [ ] Splash screen - optional
- [ ] Website/README banner - optional

### Phase 11: Logging and Diagnostics ✅ (Completed)

**Goal**: provide comprehensive logging for diagnosis and debugging ✅

- [x] Frontend logging ✅
  - [x] Shared logger utility (`src/lib/logger.ts`)
  - [x] log/info/warn/error levels
  - [x] Console output in development, configurable in production
  - [x] Log categories (module labels)
- [x] Backend logging enhancements ✅
  - [x] Diagnostic logs in Rust commands
  - [x] File-operation paths, sizes, and elapsed time
  - [x] Detailed stacks and error types on failure
  - [x] System-information startup logs
  - [x] File-metadata checks (permissions, modification time)
- [x] Critical-path coverage ✅
  - [x] File open/save flows
  - [x] Editor content synchronization
  - [x] Store state changes
- [ ] Log viewer (optional)
  - [ ] Developer-tools panel
  - [ ] Log-file export

**Usage:**

```typescript
import { createLogger } from './lib/logger'
const logger = createLogger('ModuleName')
logger.info('Opening file:', path)
logger.error('Failed to sync:', error)
```

### Phase 12: Test Enhancements ✅ (Partially Completed)

**Goal**: increase coverage and prevent similar regressions

- [x] Core utility tests ✅
  - [x] `imageUtils.ts` - 22 tests (isLocalPath, isUrl, extractImagePath)
  - [x] `parser.ts` - 41 tests (Markdown parsing, image rendering, async parsing)
- [x] Component tests ✅
  - [x] Toolbar
  - [x] Sidebar
- [x] Hook tests ✅
  - [x] useAutoSave
  - [x] useTextFormat
- [x] Store tests ✅
  - [x] editorStore
- [ ] Editor core-logic tests
  - [ ] Content synchronization (external updates vs user edits)
  - [ ] Edge cases (empty files, large files, special characters)
- [x] fileOps integration tests
  - [x] Mock Tauri invoke for file-operation flows
  - [x] Error-handling tests
- [ ] E2E enhancements
  - [ ] Complete open → edit → save flow
  - [ ] Drag-and-drop file opening
  - [ ] Keyboard-shortcut actions

**Current coverage:** 82.35% statements, 72.61% branches, 85.32% functions (`coverage/coverage-final.json`, 2026-08-21)

### Phase 13: UX Improvements (Typora Parity) ⏳ (In Progress)

> See `docs/ux-improvement-plan.md` for gap analysis and detailed plans.

#### P0 — Stop the Bleeding

- [x] Default to Source (no placeholder page before WYSIWYG is ready); rename zh-CN WYSIWYG label from “编辑” to “所见即所得”
- [x] Fix base64 write-back (preprocessed content entered the store on open and polluted .md files on save)
- [x] Fix swapped Chars/Words labels and counting algorithms
- [x] Define missing CSS variables (--text-primary, etc.); localize the “Untitled” window title
- [x] Skip fenced code blocks when parsing the outline

#### P1 — Editor Foundation (CodeMirror 6)

- [x] Replace Source/Split textarea with CodeMirror 6 (Markdown highlighting + light/dark themes)
- [x] Shortcuts: Cmd+B/I/K, Cmd+1–3 headings, list/quote toggles (eliminates false tooltip shortcuts)
- [x] Smart input: Enter continues lists/tasks/quotes, empty items exit, Tab indents, brackets pair
- [x] Undo/redo through CM6 history (operation granularity + selection restoration), replacing full-document HistoryManager snapshots
- [x] Find-and-replace panel (Cmd+F, @codemirror/search)
- [x] Paste/drag image insertion (reuse imageUtils to copy into assets)
- [x] 120ms preview debounce; 200ms outline/word-count debounce
- [x] Status bar: word count, cursor line:column, zoom, view mode

#### P2 — True WYSIWYG (Milkdown/ProseMirror) ✅

- [x] Milkdown spike: verify plugin adaptation for admonition/task-list/image pipelines
- [x] Implement WYSIWYG + `Cmd+/` Source toggle (replaces custom contenteditable route)
- [x] Custom syntax: admonition container nodes / PlantUML code-block preview / local-image nodeviews
- [x] Integration: viewMode routing for toolbar events, undo/redo, outline navigation, initial dirty-mark guard
- [x] Make WYSIWYG the default for new installations (persisted user choices unchanged)

#### P3 — Desktop Polish and Advanced Experience

- [x] Integrated macOS titlebar ✅ (Overlay + hiddenTitle + custom centered title)
- [x] Context menus ✅ (custom ContextMenu; file tree + all three editor areas Source/WYSIWYG/Preview; context-aware WYSIWYG actions for table rows/columns/links/images/code blocks; no native-menu dependency)
- [x] Native menus ✅ (macOS App/File/Edit/View/Window menubar, adapted Windows/Linux layout; 2026-08-05)
- [x] Windows borderless window + custom menubar ✅ (2026-09-04: removed system titlebar and native menubar; single-line MenuBar embedded in Toolbar; useKeyboardShortcuts handles all shortcuts; also fixed a focus-gating bug that left native-menu language in English, benefiting macOS/Linux. **0.9.1 hotfix (2026-09-07)**: changed window creation to `#[tauri::command(async)]`, fixing a self-deadlock when synchronous commands created WebView2 windows on the main thread—previously Ctrl+N/recent files left transparent zombie windows and froze the app)
- [x] Multi-window (Typora-style SDI; replaced the original multi-tab direction on 2026-08-13 and landed the same day ✅; session restore deferred to phase 2)
- [x] Theme system (partial) ✅ - light/dark/system + control colors consolidated into CSS variables (CSS theme packages/custom themes not implemented)
- [ ] Focus mode / typewriter mode
- [x] Unified custom dialogs (replace native confirm/alert; fix Cancel failures and content loss in WKWebView)
- [x] Active-outline highlighting ✅; file-tree search and management ✅; Settings panel ✅ (minimum viable: theme/language/sidebar visibility)
- [x] Offline PlantUML ✅ (2026-08-14: @plantuml/core local engine, full pipeline + dark mode + inline SVG in PDF/site export)
- [x] Mermaid support ✅ (2026-08-17, syntax batch 4 / FR-021.5)
- [x] Fullscreen diagram/image viewer ✅ (2026-08-18: GitHub-style zoom—click in preview + WYSIWYG hover zoom button, anchored wheel zoom/drag pan/double-click reset)
- [ ] HTML/Word export

#### Additional Fixes and Branding (2026-08-04/05) ✅

- [x] Fix bare relative-path images (images/x.png) not displaying; isTauri() now checks `__TAURI_INTERNALS__` (convertFileSrc had never taken effect in production)
- [x] Fix lazy WysiwygEditor creation + self-healing and error reporting after creation failures (stale HMR state made editing impossible)
- [x] Logo redesign (V + caret) + 80% macOS icon safe area (fixes oversized Dock icon); installed app updated to the new v0.1.4 build

#### P4 — Sidebar and Toolbar UI/UX ✅ (Completed, 2026-08-05)

> User feedback: the main sidebar and toolbar needed significant UI and usability improvements. These items intersect with several later tasks and benefit from unified planning rather than scattered fixes.

**Toolbar:**

- [x] Streamlined information architecture ✅: low-frequency actions (PDF export, language, zoom) moved into the custom MoreMenu (zoom/export/language/settings) and Settings; far fewer persistent controls
- [x] Removed native `<select>` language selector ✅: language switching moved into MoreMenu (custom Dropdown with checked state)
- [x] Related tasks: **native menus** ✅ (completed, hosting relocated low-frequency actions), **integrated macOS titlebar** ✅ (P3), **theme system** ✅ (P3), **Settings panel** ✅ (P3), **slash menu/floating format toolbar** (WYSIWYG completion remains a separate future item)

**Sidebar:**

- [x] Reorganized information architecture ✅: removed “Current File,” reduced tabs to Files/Outline (persisted `sidebarTab`, Outline by default); recent files support filtering (no five-item limit)
- [x] Outline enhancements ✅: active-position highlighting (P3), chevron hierarchy collapsing (OutlineTree)
- [x] File-tree enhancements ✅: search/filter, create/rename/delete, context menu (custom ContextMenu completed without waiting for native menus), first-level directory + current-file parent-chain expansion
- [x] Persisted sidebar width ✅ (`sidebarWidth`, default 224, clamped to 180–400)
- [ ] Related tasks: **multi-window** (Typora-style SDI; original tab-bar/sidebar coordination abandoned with the direction change, P3), **Settings panel** (default sidebar visibility/width, P3)

#### P5 — Second Typora-Parity Batch ✅ (Completed, 2026-08-07)

> User feedback: sidebar lacked Typora-level polish, Dock had no context menu, menus were incomplete, the titlebar could not be dragged, and VividMark was missing from Finder Open With.

- [x] **Titlebar dragging fix** ✅: add `core:window:allow-start-dragging` to capabilities (non-default since Tauri 2.10) + `data-tauri-drag-region` on Toolbar group containers (drag.js checks e.target without walking ancestors); double-click maximize restored as a side effect
- [x] **Complete native menus (Typora structure)** ✅: add top-level Paragraph (headings 1–6 ⌘1–6/body ⌘0/quote/unordered/ordered/task/code block/divider/table/image/admonition) and Format (bold ⌘B/italic ⌘I/strikethrough/inline code/link ⌘K/image); File gains Open Folder ⇧⌘O/Reveal in Finder; Edit gains Paste as Plain Text ⇧⌘V; View gains sidebar tabs ⌃⌘1/2 and Source toggle ⌘/; Actual Size moved to ⇧⌘0 (⌘0 yields to body text)
- [x] **Complete formatting capabilities** ✅: FormatType adds h4–h6/ol/paragraph (CM pure functions + Milkdown on both editors), shared by native menu/context menu/shortcuts
- [x] **Second toolbar simplification** ✅: retain only sidebar toggle/undo-redo/view switch/dark mode/⋮More; all file and formatting actions available through menus/context menus/shortcuts; table/admonition dialogs triggered by `app-open-dialog`
- [x] **macOS Dock context menu** ✅: objc2 runtime adds `applicationDockMenu:` to tao AppDelegate (new/open/recent/clear); clicks reuse the native-menu-event channel
- [x] **File associations (Open With)** ✅: `bundle.fileAssociations` declares md/markdown/mdown/mkd; `RunEvent::Opened` → queue + `file-open-request` → frontend open (cold-start queue compensation); works only after packaged installation. **2026-09-07 update**: Windows/Linux argv opening implemented (setup `collect_argv_files()` → same route); double-clicking .md no longer shows only the welcome page. Also fixed the startup flash of welcome page before file display (App gates Editor mounting until `initOpenWith` completes—on resolution the startup queue has already been drained and opened, so no first-frame welcome page). Single-instance handling remains phase 2. **2026-09-15 update**: fixed an extra welcome window on every cold-start Open With—macOS Opened may arrive before config window creation/frontend reports, so everything queues in main before `RunEvent::Ready` (APP_READY flag) instead of creating windows; `take_startup_open_files` now drains by the current window label (omitting the label steals other windows' queued files); reuse candidates add a main/clean-empty-window fallback; also fixed duplicate LogDir targets in the log plugin causing double writes
- [x] **Sidebar polish** ✅: solid Open Folder button, recent-file hover background/radius/larger icons, embedded filter-search icon, centered empty-state illustration, outline-row hover background, and accent-soft rounded selected file-tree rows
- [x] **WYSIWYG `<br>` rendering** ✅ (2026-09-09): `<br>` in table cells/paragraphs (GitHub-style) renders as a real line break instead of literal text (htmlView $view + strictBrParser `br[data-type="html"]` read rule; serialization uses original attrs.value for lossless round trips); all other inline HTML remains literal

#### P6 — Minimal Toolbar and macOS Window Fixes ✅ (Completed, 2026-08-14)

> User feedback: traffic lights were vertically misaligned (initially correct then jumping), the red button could not close the window, the toolbar remained too busy, menus wrapped, and hover feedback was too weak.

- [x] **Window-close fix** ✅: tighter Tauri 2.10 ACL made `allow-destroy` non-default, so JS destroy() after onCloseRequested without preventDefault was silently denied—capability granted; File → Close Window uses explicit Chinese text
- [x] **Vertically centered traffic lights** ✅: trafficLightPosition works at creation, but frontend setTitle makes AppKit reset button positions—new `set_window_title` command (titlebar.rs) explicitly rearranges traffic lights after setting the title
- [x] **Third toolbar simplification** ✅: only ⋮More remains; undo/redo moved to Edit, three-way theme into More, view mode to a status-bar dropdown (Dropdown gains openUp), and sidebar toggle to the left side of the status bar; E2E selectors migrated (viewMode.ts helper)
- [x] **Sidebar visual consistency** ✅: shared OpenFolderButton (sidebar/file-tree empty states, ghost style instead of solid), refined font/color hierarchy
- [x] **Menu details** ✅: whitespace-nowrap prevents item wrapping; stronger --hover-bg in both themes; three buttons share rounded hover backgrounds

---

## Next Actions

### Feature Development

- **Word export** (Phase 6 / FR-040.4; pandoc route PoC verified—plan `docs/word-export-plan.md`; `wordPreprocess` syntax mapping must cover every landed syntax batch)
- **WYSIWYG completion** - connect find/replace, slash menu / floating format toolbar (insertion entries must cover new syntax), support bare inline `@startuml` form (currently shown as source text; rendering works only in Source/Preview/Split)
- **Multi-window session restore** - reopen the window group after restart (multi-window phase 2, including Windows/Linux single-instance—double-clicking a file while running should forward to the existing process instead of starting another; argv file associations are implemented. Single-instance note: macOS is naturally single-process and needs no plugin; dev/release use separate bundle identifiers and do not affect each other)
- **Theme system** - CSS theme packages / custom theme editor (Phase 6 / 13 P3; syntax is stable enough to audit coverage)
- **Focus mode / typewriter mode** (Phase 13 P3; plan: focus mode adds a highlight class only to the current block and dims other blocks through CSS `:not()` (O(1) decoration rebuild rather than O(N)); typewriter mode keeps the active line around 40% of viewport height, uses a movement threshold (~30px) rather than time debounce, skips initial positioning to avoid load jumps, and does not scroll during IME composition)
- **HTML export** (Phase 6 / FR-040.2/.3; good first issue #5 filed)
- **Document history snapshots** - snapshot every manual/auto save, browse and roll back by day in the sidebar; use a coalescing window for automatic snapshots and snapshot current content before rollback; store in path-hash directories (appDataDir/history/), with count/age/per-file-size guardrails; snapshot failures must not block saving
- **Markdown lint (candidate)** - document-quality checks: undefined/unused references, inconsistent table columns, skipped heading levels, empty links, broken anchors, unclosed fences, etc.; manual trigger + inline/block diagnostics, especially valuable for MkDocs writing
- **Command palette (candidate)** - reassess as the feature surface grows; command registry (id/title/category/`when` context filtering) shares menu actions, and palette filtering/execution gating share the same context snapshot

### Experience and Optimization

- **Performance** - large files (Phase 7; tiered thresholds: open progress / automatically use Source for large files (status bar retains a WYSIWYG upgrade entry) / confirm before open / reject beyond limits; secondary WYSIWYG degradation: disable spellcheck for large documents, pause content-visibility during input, yield first parse to render the shell first)
- **Crash recovery** - third layer beyond auto-save and file watching: atomically write (tmp+rename) unsaved content to a recovery directory roughly every 10s; restore as a dirty document after abnormal exit; clear snapshots on save/close, deduplicate by content, and clean expired snapshots automatically
- **Reading-position memory** - remember scroll/cursor positions per document and view mode; restore after mode switches, external reloads, and restarts; use rAF to keep correcting the target until stable (a one-time scrollTop write is clamped incorrectly while async diagrams/images increase height), immediately yielding to user scrolling/input
- **Cross-mode undo continuity** - checkpoint content + cursor on view-mode switches; when the current editor's native history is exhausted, further undo restores checkpoint content without switching modes; redo first verifies the document has not diverged from the branch point
- **CJK word boundaries** - use Intl.Segmenter (word granularity) for double-click selection/word cursor movement so Chinese no longer selects an entire paragraph as one word
- **Window-event readiness protocol** - queue targeted menu/Dock events per window until its frontend is ready, then flush; eliminates emit_to_focused event loss during cold starts/new-window creation
- **Cross-platform PDF bookmarks/page numbers** - use lopdf (pure Rust) for export post-processing to inject outline bookmarks and page numbers on all three platforms (replacing the macOS-only PDFKit route); degrade failures to warnings without blocking export
- **Precise Split scroll synchronization** - current percentage mapping is inaccurate for content with very different lengths; consider heading/paragraph-position or caret-based smart synchronization and sensitivity controls
- **Admonition enhancements** - collapsible `??? note` syntax (good first issue #4 filed); nesting support
- **Menu keyboard navigation** - add arrow-key navigation and Alt mnemonics consistently to MenuPanel/MenuBar/Dropdown/ContextMenu (made more visible after the custom menubar landed on 2026-09-04)
- **New-window white-flash transition** - new Windows windows show all white before content renders (WebView2 default white + pre-load window background); the frontend could pass the current theme background to `open_in_new_window`, and window creation could set the window/WebView2 background (user feedback from 0.9.1)

### Engineering

- **E2E enhancements** - complete user flows (open→edit→save, drag open, shortcuts; good first issue #3 filed)
- **Complete Editor / fileOps tests** (remaining Phase 12 items; good first issue #6 filed)
- **Contributor infrastructure** ✅ (2026-08-14: bilingual CONTRIBUTING, bug/feature issue forms, PR template, CODE_OF_CONDUCT, README contribution section); pre-commit hooks (husky + lint-staged) - optional
- **Commit-message secret scanning** - git hook shape-detects commit messages (stacked environment variables/common token patterns), fail-closed; a safeguard for a public repository with AI collaboration
- **Pre-push tag verification** - before pushing a v\* tag, verify required CI checks are green for the corresponding SHA (gh api check-runs), fail-closed when the API is unavailable, preventing unhealthy releases (releases are tag-triggered)
- **Local coverage thresholds** - set Vitest coverage thresholds with a small buffer below measured values and raise them as coverage improves, catching regressions locally before Codecov
- Log viewer / log export - optional
- Splash screen / website banner - optional

### Community and Outreach

- **SEO** ✅ (2026-08-14): Pages keyword title/description, OG/Twitter cards (og-image 1200×630), JSON-LD structured data, bilingual hreflang links, sitemap.xml + robots.txt; site verified in Search Console and sitemap submitted. Remaining: Bing Webmaster Tools submission
- **External listings**: awesome-markdown-editors PR mundimark#220 (pending merge); HelloGitHub submission 521xueweihan/HelloGitHub#3538 (manual monthly selection); AlternativeTo pending—anti-spam restriction expired (2026-08-21), so a listing can be submitted as a Typora/Obsidian/MarkText alternative
- **Community collaboration**: Windows/Linux testing recruitment #1 (pinned; maintainer only has macOS); good first issue #2 (new i18n language) / #3 / #4 / #5 / #6; unissued candidate: precise Split scrolling (help-wanted level) (Mermaid and file watching already landed; do not issue duplicates)

---

## Session Records

Historical development logs were archived to `docs/session-log.md` (moved from this file on 2026-08-07).

---

## Startup Commands

```bash
pnpm tauri:dev     # Development mode (frontend + Rust)
pnpm tauri:build   # Build
```

---

## Notes

1. **Network issues**: use Tsinghua mirrors
   - Cargo: configured in `~/.cargo/config.toml`
   - npm: automatically uses the mirror

2. **Proxy issues**: the Git proxy has been cleared; restore it if needed:
   ```bash
   git config --global http.proxy http://127.0.0.1:7897
   git config --global https.proxy http://127.0.0.1:7897
   ```
