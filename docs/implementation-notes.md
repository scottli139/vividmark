# VividMark Implementation Notes

**English | [简体中文](implementation-notes.zh-CN.md)**

> This document collects detailed implementation notes, pitfalls, and release/operations procedures moved out of `AGENTS.md`.
> For task progress, see [`PLAN.md`](../PLAN.md); for the concise agent guide, see [`AGENTS.md`](../AGENTS.md).

## Contents

- [Known Issues](#known-issues)
- [Markdown Extension Implementation](#markdown-extension-implementation)
- [Editor Architecture](#editor-architecture)
- [Sidebar File Tree](#sidebar-file-tree-implementation)
- [Toolbar Layout](#toolbar-layout-2026-03-06)
- [Windows Path Handling](#windows-path-handling)
- [PDF Export in Detail](#pdf-export-in-detail)
- [Logging](#logging)
- [Tauri Commands](#tauri-commands)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [CI/CD and Release](#cicd-and-release)
- [Git Repository Management](#git-repository-management)
- [Typst Offline Support](#typst-offline-support)

---

## Known Issues

### Monospace Fonts in Code Blocks (CJK Alignment)

> Current status: ASCII art mixing CJK and Latin text cannot be aligned reliably.

**Description:**
When Markdown code blocks mix CJK and Latin text (for example, in ASCII flowcharts), CJK and ASCII characters do not align correctly.

**Cause:**

- A full-width CJK character should be twice as wide as a half-width ASCII character.
- WebView rendering cannot consistently preserve that 2:1 ratio.
- Multiple monospace fonts (Menlo, Monaco, Courier New, and others) have not solved it.
- This is a low-level WebKit/WebView rendering limitation.

**Approaches tried:**

1. ✅ Several system monospace fonts
2. ✅ `font-variant-ligatures: none` to disable ligatures
3. ✅ Forced monospace inheritance on all children
4. ✅ The `-webkit-font-feature-settings` prefix
5. ❌ None worked

**Recommended alternatives:**

- Use **Mermaid** for diagrams (supported by VividMark).
- Use **PlantUML** for professional diagrams.
- Avoid mixing CJK and Latin text in ASCII diagrams; use ASCII-only content.

### Default PDF Export Filename

> ✅ Resolved (Typora-style direct save): export now uses “save dialog → silently generate PDF”; the filename is the user's choice, with no print dialog. See “PDF Export in Detail” below.

### Linglong Linux Package Text Appears Top-Aligned (Vertical Centering Fails in Buttons/Tables/Inputs)

> ✅ Resolved (2026-09-03): Linux-specific concrete font names were added to font-family fallbacks, as described below.

**Symptom**: In the Linglong package (which bundles deepin beige webkit2gtk-4.1 **2.46.3**), all vertical centering—including button text, table cells, and input placeholders—appears shifted to the top. Host WebKitGTK 2.38 (2.38.6-deepin1 supplied by UOS 1070) and macOS are normal.

**Root cause**: The engine returns **zero-metrics fonts** (ascent/descent=0) for **family names that are not literal installed names** (`-apple-system`, `BlinkMacSystemFont`, generic `sans-serif`/`system-ui`, including fontconfig aliases/fuzzy matches). Layout itself is correct (box height and centering calculations), but glyph ink is drawn upward from a collapsed zero-height inline box, making everything appear top-shifted. Literal installed families such as `Source Han Sans SC`, `Noto Sans CJK SC`, and `DejaVu Sans` work correctly. The old Linux stack contained only non-literal names, so the entire page was affected.

**Fix**: Add concrete Linux family names before generic names in every font-family stack—body text gains `'Noto Sans CJK SC', 'Source Han Sans SC', 'Noto Sans', 'DejaVu Sans'` (globals.css body), and monospace stacks gain `'Noto Sans Mono CJK SC', 'DejaVu Sans Mono'` (code rules in globals.css + CodeMirrorEditor cm-scroller). WebKit skips non-literal names and selects the first concrete family; existing macOS/Windows matches (-apple-system/Segoe UI/Courier New) remain unchanged with no regression.

**Verification** (reusable engine-level probe): `/tmp/wktest/probe41.c` (host gcc links the Linglong package's .so + base glibc and runs the real 2.46.3 inside the container through `ll-cli run … -- /run/host/rootfs/…`). In-page JS uses Range rects to quantify vertical text position (Range height collapses to 0 with zero metrics and equals the em box height when centered). Both approaches center correctly on healthy engines (2.38/macOS).

### Linglong Linux Desktop/Menu Shortcuts Fail to Launch and Show Gear Icons

> ✅ Resolved (2026-09-03): removed the `%F` placeholder from Exec, as below. See pitfalls 11/13/14 in `linglong/README.md`.

**Symptom**: Neither the Start-menu icon nor a “Send to Desktop” shortcut launches the app when double-clicked; desktop shortcuts show two fallback gear icons.

**Root causes (two independent issues)**:

1. **Launch failure = ll-cli 1.5.6 desktop-rewrite bug**: during build, ll-builder rewrites the packaged desktop file's `Exec` into `ll-cli run` form. If the original Exec contains `%F`, it becomes `ll-cli run <id> --file %F -- -- <bin> %%F`. With no file, `%F` expands empty and `--file` exits with a usage error; with a file, the extra inner `--` is executed as a command (`--: command not found`). Both paths fail. Removing `%F` produces clean `ll-cli run <id> -- <bin>` (verified with a probe package and real `GDesktopAppInfo.launch`). In 1.5.6, `--file` also does not pass the path into the container command line (`%F` is not replaced and argv is not appended), so file-association paths could not arrive anyway.
2. **Gear icons = stale process-level dde-desktop icon cache**: Qt and GTK resolve icons for newly installed Linglong apps correctly (entries are already in XDG_DATA_DIRS), but dde-desktop keeps showing fallback gears if it started before installation. `killall dde-desktop` (it restarts automatically) or logging in again resolves it.

**Operations pitfall**: ll-cli 1.5.6 `install` of a new version **does not refresh entries exports** (symlinks remain pinned to the initially installed version's commit directory). Before testing another package, fully uninstall each version with `ll-cli uninstall <id>/<version>`, then reinstall.

### Three Thick Bars at the Top on Linux → Borderless Custom Titlebar (Frameless)

> ✅ Resolved (2026-09-04): window decorations are disabled on Linux and Toolbar doubles as a custom titlebar, as below.
> (A 2026-09-03 GTK CSS injection added a top border to the menubar to address the missing titlebar/menubar divider. This solution supersedes it—the system titlebar no longer exists in frameless mode, so the divider issue disappears; the CSS injection has been removed.)

**Symptom**: On deepin/UOS, three bars stack at the top—KWin SSD titlebar (~35px) + native GTK menubar (~30px) + application toolbar (48px), totaling ~113px. macOS combines all three (traffic lights + document name + ⋮ in one 48px toolbar). Also, the deepin GTK theme's CSD `.titlebar` divider does not apply in SSD mode (the theme does not draw the SSD titlebar; a native host GTK3 probe also has no divider, so this is inherent X11 behavior).

**Solution** (following custom-titlebar conventions in Linux desktop apps such as VS Code):

- **Rust**: The main window (lib.rs setup) and new document windows (window_router `create_document_window`) use `set_decorations(false)` / `.decorations(false)` on Linux to remove the system titlebar. **The native GTK menubar remains**—all desktop shortcuts are driven by native-menu accelerators (the webview cannot receive accelerator keys), so the menubar cannot be removed. The top changes from three bars to two (menubar + toolbar ≈ 78px).
- **Frontend Toolbar doubles as titlebar** (gated by `isLinuxDesktop()`, UA detection + isTauri in `src/lib/platform.ts`): custom centered document name (left/right containers use equal-width `flex-1 basis-0` for true centering; hidden below 760px, matching macOS); right-side `WindowControls.tsx` implements minimize/maximize toggle/close (maximize state tracked through `isMaximized()` + `onResized`). **Close uses `win.close()`** → `CloseRequested` → windowManager dirty-confirmation interception, the same path as the system titlebar.
- **Drag/double-click maximize require no new code**: Toolbar root and left/right groups already have `data-tauri-drag-region`; Tauri's built-in drag.js maps mousedown → `start_dragging` and double-click → `internal_toggle_maximize` on Windows/Linux.
- **Edge resizing**: with decorations disabled, the WM no longer supplies resize borders. `WindowResizeHandles.tsx` places transparent hit areas on four edges (4px) and corners (12px); mousedown → `startResizeDragging(dir)` (internally `gtk_window_begin_resize_drag`, with KWin taking over as usual). Handles hide while maximized (avoiding the right scrollbar/status bar).
- **Capabilities**: add `core:window:allow-minimize` / `allow-close` / `allow-toggle-maximize` / `allow-internal-toggle-maximize` (drag.js double-click) / `allow-is-maximized` / `allow-start-resize-dragging`.

**Pitfall**: `@tauri-apps/api` 2.10 does not export the `ResizeDirection` type (it is only declared locally in window.d.ts), so the component replicates the union locally.

**Related fixes (2026-09-04, two menu issues)**:

- **Empty Window menu / no Exit in File / no Fullscreen in View**: muda 0.17's GTK backend `is_item_supported` allowlist permits only `Separator`/`Cut`/`Copy`/`Paste`/`SelectAll`/`About`; predefined `Minimize`/`Maximize`/`Quit`/`CloseWindow`/`Fullscreen` items are **silently dropped** (Windows/macOS backends are normal). Linux uses custom items everywhere: `window:minimize`/`window:maximize` (Window), `view:fullscreen` F11 (View), and `file:exit` Ctrl+Q (File → Rust `quit_app`, closing each window through CloseRequested dirty confirmation rather than bypassing it with `app.exit`). macOS/Windows retain predefined items.
- **Popup-menu text sits too high (not a packaging issue)**: a 42px row with 20px ink measured 8px above and 14px below. deepin GTK menuitem padding is symmetric (5px), but the menu font (Source Han Sans/Noto CJK) has a large line box and high baseline. **A native host GTK3 probe behaves identically** (`/tmp/gtk3_menu_probe2.py`, automatically opening a menu through a GLib timer), so Linglong is unrelated. Fix: `fix_deepin_menuitem_alignment()` (lib.rs, only when gtk-theme-name contains deepin) injects `menu menuitem { padding-top: 8px; padding-bottom: 2px; }` to restore visual centering; other themes are unchanged. Linux-only `gtk`/`gdk` 0.18 dependencies in Cargo.toml were reintroduced for this. Menubar text itself was centered (11px above, 9px below in measurements) and was not changed.
- **Menubar text shifts right (muda control-structure issue)**: an 80px menubar item had text ink at left 30/right 8 instead of native GTK's symmetric 8/8. Root cause: muda 0.17's GTK backend packs **every** item as `GtkBox(spacing=6) + GtkImage + AccelLabel`; without an icon, image is an empty `unwrap_or_default()` GtkImage whose natural width is always 16 (GTK default icon size), occupying 16+6=22px and pushing text right. A replicated probe matched app screenshots exactly (item w=80, left=30/right=8); deepin's own `menubar > menuitem { padding: 4px 8px }` is symmetric, so the theme is not at fault. `image.hide()` does not help (GtkBox still reserves space for hidden children); **the image must be `remove`d from the Box** (the probe returned to 8/8). Fix: `strip_menubar_icon_placeholders()` (lib.rs, Linux only) walks each gtk_window control tree to find GtkMenuBar and removes empty Images without pixbuf from item Boxes. Three call sites: setup, rebuild_menu (set_menu rebuilds the control tree), and window_router after creating a window (the app menu is attached synchronously during creation). Only the menubar is changed; muda already compensates popup items with `margin-left:-22px`.

**Verification**: real-device screenshots after rebuilding the Linglong package confirmed only menubar + toolbar remain, with working centered title, three buttons, drag movement, double-click maximize, edge resize, and F10 menus; both Window items work, File has Exit, and popup text is centered.

### Three Bars at the Top on Windows → Borderless + Custom MenuBar (Frameless + MenuBar)

> ✅ Resolved (2026-09-04): Windows disables window decorations and **removes the native menubar**; menus and shortcuts are entirely frontend-driven.

**Symptom**: Windows also stacked three bars—system titlebar + native menubar (classic Win32 style, always white and glaring in dark mode) + application toolbar. Two related issues: the OS controls native popup position (visually shifted right and uncontrollable by the app), and menu language depends on rebuild_menu timing, which can leave it in English (see “Root cause” below).

**Solution** (following VS Code / Typora-for-Windows custom-titlebar conventions; one 48px toolbar contains everything):

- **Rust**: The main window (lib.rs setup) calls `set_decorations(false)` after creation. For new document windows (window_router), **Linux uses `decorations(false)` during creation, while Windows must call `set_decorations(false)` only after successful creation** (see “Root cause: zombie new windows” below). **Windows does not attach an application menu** (setup's `build_menu`/`set_menu` are wrapped in `cfg(not(windows))`, and `rebuild_menu` is a Windows no-op). menu.rs builders are used only on macOS/Linux; `#![cfg_attr(target_os = "windows", allow(dead_code))]` keeps the module compiling (`RecentFilePayload` remains referenced by the rebuild_menu signature).
- **Menubar**: `src/components/Menu/MenuBar.tsx` sits in Toolbar's left group (menu buttons + click toggle + hover switching while open + Escape/outside click close; dropdown MenuPanel aligns its left edge exactly with the menu item). Render gate is `!isMacOSDesktop() && !isLinuxDesktop()`—**browser dev/E2E also displays it** (directly covered by `e2e/menubar.spec.ts`). Builder `src/lib/menuBar.ts` is pure: structure/IDs align with menu.rs Windows layout (File/Edit/Paragraph/Format/View/Window/Help), checked/disabled read the store reactively (eliminating imperative set_menu_item_checked synchronization and multi-window focus gating), and recentFiles dynamically generates Open Recent. Clicks reuse `handleMenuAction`; `initNativeMenu` is skipped entirely on Windows.
- **Shortcuts**: with no native Windows menu, accelerators are no longer OS-intercepted, so `useKeyboardShortcuts.ts` handles the full table (aligned with menu.rs). **Reentry is prevented by `e.defaultPrevented`**: editor keymaps (CM Mod-F/Z, Milkdown Mod-B/I) handle and preventDefault first, then the hook skips them; keys not bound by editors (Ctrl+1–6, etc.) reach the hook normally. Text inputs allow only non-text-editing actions (file/view/settings/F11). Editor.tsx's old window-level zoom listener (Ctrl+=/-/0) was deleted and merged into the hook (otherwise zoom ran twice).
- **Predefined-item replacements** (native Cut/Copy/Paste/About no longer exist): four Edit clipboard actions → `editor-cut/copy/paste/select-all` CustomEvents, with each editor listening and reusing its context-menu implementation (CM: selection.sliceDoc/clipboard.ts; WYSIWYG: existing `applyWysiwygContextAction` cut/copy/paste/select-all; Preview: copy/select-all only, with copy reading window.getSelection). Help ▸ About → `AboutDialog.tsx` (`getVersion()`, browser fallback dev); Window Minimize/Maximize, View Fullscreen, and File Exit reuse Linux custom IDs (`window:*`/`view:fullscreen`/`file:exit`).
- **Window chrome**: custom filename in Toolbar + `WindowControls` (rendered for `linuxFrameless || windowsFrameless`) + `WindowResizeHandles` (same condition). Linux already granted all capabilities (`windows: ["*"]`), so no changes were needed.

**Root cause (menu stuck in English)**: `initNativeMenu` performed initial `rebuildMenu` only when `isFocused()` was true (which can be false during Windows startup), while `onFocusChanged` synchronized check/enabled without rebuilding labels → menus stayed at Rust setup's default "en". `rebuildMenu` also wrote `lastRebuildKey` before invoke, so one failure deduplicated retries forever. Fix: focus callback also calls `rebuildMenu` (deduplicated and cheap), and invoke failure resets the key. This also benefits macOS/Linux (nativeMenu.ts); Windows is naturally immune because its custom menu renders reactively.

**Root cause (zombie new windows, 0.9.0 → 0.9.1 hotfix)**: In 0.9.0 on Windows, Ctrl+N / File→New / recent files could freeze the app after creating a window. The chain: `build()` **hangs while creating the WebView2 controller** (the OS window exists, but `Chrome_WidgetWin_0` remains a hidden 0x0 with no rendering chain, becoming a **non-drawing, transparent, click-swallowing** zombie top-level window over other windows; Win32 reports `Responding=True`, CPU 0%, and no modal disabled state, making it misleading). **Actual cause: both window-creation commands (`open_in_new_window`/`route_open`) were synchronous—Tauri synchronous commands run on the main thread, and calling build() on that thread after its event loop starts self-deadlocks** (WebView2 creation completion callbacks require event-loop dispatch, but build() itself blocks that loop; part of the [wry#583](https://github.com/tauri-apps/wry/issues/583) family, and Tauri officially requires window-creation commands to be async). Two false leads were disproved by measurement and should not be retried: ① calling set_decorations(false) after build to rule out innate frameless behavior—no effect; ② reusing the main WebView2 environment through `with_webview` + forcing main-thread creation with `run_on_main_thread`—this moved the hang into the event loop and made even closing windows impossible. Fix (return to the simplest route): mark both commands `#[tauri::command(async)]` (Tauri runs them on runtime workers, where wry's `wait_with_pump` receives completion callbacks normally); macOS/Linux retain main-thread creation (AppKit/GTK thread affinity)—directly when already on main (macOS Opened path), otherwise dispatched through `run_on_main_thread` (the event loop is free under async commands, so no self-deadlock); setup records the main-thread id for routing. `open_in_new_window` failures now use `log::error!` to write to the log file (previously silent: Rust propagated Err without logging and the frontend logged only to the webview console). **Remaining UX item**: new windows show white before content (WebView2 default white); frontend calls could eventually pass the current theme background.

**Remaining/future**: no keyboard navigation in the menubar (arrows/Alt mnemonics)—all menu primitives lack keyboard navigation and will address it together; Win11 snap-layout hover (specific to native maximize buttons) is unavailable in frameless mode, while drag-to-edge snapping still works.

---

## Markdown Extension Implementation

### Admonitions (Callout Boxes)

VividMark supports MkDocs-style admonitions using `markdown-it-container`:

**Dependencies:**

```bash
pnpm add markdown-it-container
pnpm add -D @types/markdown-it-container
```

**Implementation in `parser.ts`:**

```typescript
import container from 'markdown-it-container'

const admonitionTypes = ['tip', 'warning', 'info', 'note', 'danger', 'success']

admonitionTypes.forEach((type) => {
  md.use(container, type, {
    render: function (tokens, idx) {
      const token = tokens[idx]
      const info = token.info.trim().slice(type.length).trim()

      if (token.nesting === 1) {
        const title = info || type.charAt(0).toUpperCase() + type.slice(1)
        return `<div class="admonition ${type}">
  <div class="admonition-title">${title}</div>
  <div class="admonition-content">`
      } else {
        return '</div></div>\n'
      }
    },
  })
})
```

**CSS Styling:**

- Each admonition type has distinct color scheme (blue for tip/note, orange for warning, etc.)
- Dark mode support via CSS variables
- Emoji icons via `::before` pseudo-element

### PlantUML Diagrams

**Dependencies:**

```bash
pnpm add @plantuml/core    # Local rendering engine (TeaVM compiled, MIT, offline)
pnpm add plantuml-encoder  # Online-service URL encoding (fallback when local rendering fails)
```

**Implementation:**
Two syntax entries, both produce placeholders (async local rendering):

1. **Code block syntax** (` ```plantuml ``` `) - handled in highlight function
2. **Inline syntax** (`@startuml...@enduml`) - preprocessed before markdown parsing

Both entries emit `data-plantuml-src` placeholders, rendered offline as inline SVG by the local engine (`src/lib/plantuml.ts renderPlantUmlSvg`), with fallback to an online plantuml.com image on failure. See “2026-08-14 PlantUML Local Rendering” near the end for engine selection, serial queue, dark mode, and testing strategy.

### Task Lists (Checkboxes)

**Markdown syntax:**

```markdown
- [ ] Unfinished task
- [x] Completed task

* [ ] Asterisk markers are supported
```

**Implementation notes:**

1. **Preprocessor (preprocessTaskLists)**
   - Uses `/^(\s*)([-*])\s+\[([\sxX])\]\s+(.*)$/` to match task lists
   - Replaces `[ ]` or `[x]` with the special marker `[[TASK:index:status]]`
   - Preserves remaining content so markdown-it parses Markdown normally

2. **Postprocessor (postprocessTaskLists)**
   - Replaces `[[TASK:index:status]]` with checkbox HTML
   - Handles two forms:
     - `<li><p>[[TASK:...]]</p></li>` (markdown-it automatically wraps p tags)
     - `<li>[[TASK:...]]</li>` (ordinary case)
   - Generates checkboxes with `data-task-index` for interaction

3. **HTML structure**

   ```html
   <li class="task-list-item" data-task-index="0" data-task-status="unchecked">
     <input
       type="checkbox"
       class="task-checkbox"
       data-task-index="0"
       data-task-status="unchecked"
     />
     <span class="task-content"
       >Task text (supports <strong>bold</strong> and <a href="...">links</a>)</span
     >
   </li>
   ```

4. **Key CSS**
   - `display: flex` aligns checkbox and text
   - **Important**: content must be wrapped in `<span class="task-content">` so flex does not separate children
   - Custom checkbox styling supports dark mode

5. **Interaction (Editor.tsx)**
   - Listens for preview-area clicks
   - Uses `data-task-index` to find the corresponding Markdown line
   - Toggles `- [ ]` ↔ `- [x]` and updates document content
   - Integrates with history for undo/redo

6. **Key fix: dangerouslySetInnerHTML state synchronization**

   **Problem**: with `dangerouslySetInnerHTML`, the browser changes a checkbox's `checked` property before the click event, causing incorrect state decisions.

   **Solution**:
   - Read `data-task-status`, not `checkbox.checked`
   - After HTML updates, use `useEffect` to synchronize checkbox DOM state manually

   ```typescript
   // Synchronize checkbox state after HTML updates
   useEffect(() => {
     if (previewContainerRef.current) {
       const checkboxes = previewContainerRef.current.querySelectorAll('.task-checkbox')
       checkboxes.forEach((checkbox) => {
         const el = checkbox as HTMLInputElement
         const status = el.getAttribute('data-task-status')
         const shouldBeChecked = status === 'checked'
         if (el.checked !== shouldBeChecked) {
           el.checked = shouldBeChecked
         }
       })
     }
   }, [renderedHtml])
   ```

7. **Insertion entry**
   - The toolbar button was removed during toolbar simplification (both `FormatButton` and `useTextFormat.ts` were deleted)
   - The `format:tasklist` action now triggers it through native Format menu / Windows MenuBar / editor context menu “Format ▸ Task List” / `Cmd/Ctrl+Alt+X`
   - The action dispatches `editor-format` (format type `'tasklist'`); Source mode uses `tasklist: '- [ ] '` from `markdownEditing.ts` to insert `- [ ] ` at the cursor (an unchecked task item)

**Notes:**

- When task and ordinary lists are mixed, only task items receive `task-list-item`.
- Global `globalTaskIndex` uniquely identifies each checkbox.
- Call `resetTaskIndex()` before each render to reset the counter.
- **Important**: both checkbox and li need `data-task-status`; click handling reads the checkbox attribute.

### Math Formulas (KaTeX)

Implemented in both editors; syntax rules must match exactly or formulas flicker when switching Source/WYSIWYG:

- **markdown-it**: `src/lib/markdown/mathPlugin.ts`—custom inline/block rules (no third-party plugin such as markdown-it-katex)
- **WYSIWYG**: `mathPlugin.ts` (remark-math + `math_inline`/`math_block` atom schema) + `mathView.ts` (nodeview; clicking a formula opens textarea editing)
- **Syntax strictly follows micromark-extension-math 3.x**: block math supports only multiline fences (`$$` alone on opening/closing lines); single-line `$$x$$` always parses as inline math; no pandoc-style currency protection (`$5` receives no special exemption)
- **PDF export**: `inlineKatexFonts` in `exportPdf.ts` converts KaTeX woff2 fonts to base64 and inlines them into exported HTML—the `vividmark-pdf://` custom-protocol window cannot load in-app fonts, so formula fonts would otherwise be missing

### YAML Frontmatter (2026-08-14)

Supported in both editors; the pure-function base is `src/lib/markdown/frontmatter.ts` (moved from `siteConfig.ts` and re-exported there, preserving old import paths):

- **Preview/export**: `parseMarkdown`/`parseMarkdownAsync` in `parser.ts` call `parseFrontmatter` before rendering—only a `---` fence at the document start applies; **YAML parse failures conservatively preserve the original text** rather than forcing removal; `---` in the middle remains a horizontal rule. PDF/site export inherit this automatically (site-export P1 already used the same pure function to read `title`).
- **Outline denoising**: `outlineUtils.extractOutline` skips frontmatter line ranges by line number (`#` inside is a YAML comment, not a heading); **it skips rather than strips text**, preserving source lineIndex/charIndex needed by Source navigation.
- **WYSIWYG**: `frontmatterPlugin.ts` (remark-frontmatter + `frontmatter` atom block schema, YAML source in attrs.value) + `frontmatterView.ts` (read-only nodeview: label + pre source; edit in Source mode); micromark-extension-frontmatter + mdast-util-frontmatter handle parsing/serialization with byte-for-byte value preservation.
- **Pitfall: Milkdown `$remark` options default to `{}`**—`$remark(id, factory)` internally uses `initialOptions ?? {}` and passes it unchanged to `remark.use(plugin, options)`. Remark plugins that validate options (remark-frontmatter treats `{}` as a matter object and throws `Missing type in matter {}` when `type` is absent) **require an explicit third argument** (frontmatter passes `'yaml'`). Apply this lesson when adding remark plugins for Alerts/footnotes and later batches.

### GitHub Alerts (`> [!NOTE]`, 2026-08-17)

Supported in both editors (syntax batch 1; both share `matchAlertMarkerLine` from `src/lib/markdown/githubAlert.ts`):

- **Preview/export**: `githubAlertPlugin.ts`—**core-rule blockquote-token postprocessing** (not a block rule: CommonMark blockquote semantics come free from the block parser). On a match (`[!TYPE]` alone on the first line of the first paragraph), blockquote_open/close become `github_alert_open/close`; rendering reuses three-part `<div class="admonition <type>">` (zero CSS adaptation), and marker text/newline are stripped from inline.children. If the marker is the only content, the empty-paragraph trio is spliced out too. The rule sits at the end of the core chain (after text_join, so the marker is guaranteed to be the first text token).
- **WYSIWYG**: `githubAlertDecorations.ts`—**pure PM Decoration with zero schema changes**: matching blockquotes receive `admonition <type> github-alert` classes (reusing admonition light/dark colors to match preview), the first paragraph gets a `::before` type icon, and marker text gets colored/bold InlineDecoration. The marker line remains visible/editable; changing to `[!TIP]` changes color and deleting `]` returns to an ordinary quote. Marked markers (`**[!NOTE]**`) are not decorated (matching preview regex behavior).
- **Recognition (GitHub-aligned; stricter where Obsidian differs)**: only five types (note/tip/important/warning/caution); unknown types, trailing text on the marker line, Obsidian `+`/`-` fold markers, or a marker not on the first line all degrade to an ordinary blockquote with source preserved.
- **Pitfall: tolerate both forms produced by our serializer**—① Milkdown toMarkdown escapes `[` as `\[` (to prevent link misclassification), so saved marker lines are `\[!NOTE]`; ② when inline soft breaks serialize as `\`+newline, the marker line gains a trailing `\`. `matchAlertMarkerLine` therefore permits opening-bracket escapes and trailing `\`/whitespace (an intentional deviation from strict GitHub behavior, prioritizing cross-editor consistency).
- Milkdown's hard-break node is `hardbreak` (not prosemirror-markdown's `hard_break`), so PM first-line extraction uses that name.

### Footnotes (`[^id]`, 2026-08-17)

Supported in both editors (syntax batch 2):

- **Zero new WYSIWYG schema**: Milkdown's `gfm` preset includes `footnote_reference` (inline atom, attrs.label) and `footnote_definition` (block, `block+`, dl>dt+dd structure); remark-gfm's micromark/mdast extensions handle parsing and serialization—ready on registration, with byte-lossless round trips (`wysiwygRoundtrip.test.ts` locks reference/definition pairing, multiple references to one definition, unreferenced-definition preservation, and non-normalized definition position). Research verified this and avoided the originally planned custom `$remark` + dual schema.
- **Number decorations** (`footnoteDecorations.ts`, pure PM Decoration): inject `data-footnote-number` in first-reference order (matching markdown-it-footnote preview numbering); CSS `font-size:0` + `::before { content: '[' attr() ']' }` replaces the original label with `[N]`. **Dangling references (definition deleted) are not numbered**—the original label remains, matching preview's fallback to literal text when no definition exists. Definition blocks are not numbered; `dt` displays the label identifier (flex layout `[^label]: content`, following task-list-item).
- **Preview/export**: `markdown-it-footnote` (`md.use(footnote)` in parser.ts). Override `md.renderer.rules.footnote_caption` to always output `[N]`—the default emits `[N:M]` from the second reference to one definition, which differs from GitHub/Typora. href/backlink IDs retain default rules. Unreferenced definitions are not rendered (same as GitHub); numbering follows first-reference order, not definition order; consecutive renders on the same md instance isolate env counters naturally (each render receives a new env).
- **Anchor navigation**: preview clicks on `a[href^="#"]` no longer use `open()` for external navigation—`Editor.tsx handlePreviewClick` intercepts and uses `scrollIntoView` (comparing element ids one by one to avoid CSS.escape jsdom compatibility). Site export supports in-page anchors naturally; `rewriteMarkdownLinks` does not rewrite pure `#` hrefs (empty pathPart).
- **Styles**: the “Footnotes” section in globals.css is shared by all three targets (export inherits through collectDocumentCss): preview `.footnotes` uses a small muted endnote block + `scroll-margin-top`; WYSIWYG superscripts use accent, and dangling references display gray `[^label]`.

### Mermaid (2026-08-17, Syntax Batch 4 / FR-021.5)

Supported in both editors, reusing PlantUML placeholder + lazy-loading infrastructure (batch 4 in `docs/syntax-extensions-plan.md`):

- **Rendering wrapper** (`src/lib/mermaid.ts`): official `mermaid` npm package (v11), **lazy-loaded through dynamic-import chunking** (loaded only for the first mermaid block, chunk ~1MB+); same serial queue + LRU cache + inflight deduplication as plantuml.ts (`mermaid.initialize` is global configuration and `render` attaches a temporary container to body for layout, so concurrency is unsafe). Theme is fixed at render time: when `dark` changes, re-run `initialize({ theme: dark ? 'dark' : 'default' })` and rerender. `suppressErrorRendering: true` prevents the engine from inserting error graphics into body (we display errors ourselves); finally cleans residual `#id`/`#d{id}` containers.
- **Key difference from PlantUML: no online fallback**—there is no equivalent public service for offline use. Rendering failures (usually syntax errors) consistently show `pre.hljs.mermaid-error` + original source (same in progressive preview, inline export, and WYSIWYG nodeview).
- **Preview** (parser.ts): only ` ```mermaid ` fenced form (no `@startuml`-style inline syntax, no code-region masking needed). The highlight callback emits `data-mermaid-src` placeholders → `renderMermaidPlaceholders` progressively renders (same Editor.tsx effect as PlantUML, deps include viewMode) → export `inlineMermaid: true` inlines SVG (connected in exportPdf/exportSite).
- **WYSIWYG** (generalized plantUmlCodeBlockView.ts): `diagramLanguageOf()` dispatches plantuml/mermaid dual-pane nodeviews by language (preview + editable source, classes `mermaid-block`/`mermaid-diagram` parallel to plantuml). **Any kind change (including plantuml ↔ mermaid) makes update() return false to rebuild**. Serialization uses the original code_block path and is naturally lossless; codeHighlightPlugin skips mermaid (same as plantuml).
- **Tests**: mermaid.ts injects a fake renderer (`setMermaidRendererForTests`, since jsdom has no layout engine); parser/nodeview mock `renderMermaidSvg`; real-engine smoke coverage in `e2e/mermaid.spec.ts` (syntax-error state and viewMode-switch regression).
- **Sequence actor boxes**: initialize passes `sequence: { height: 46 }`—default 65 leaves excessive vertical space around 16px text (actor box height comes from `conf.height`). **WebKit vertical-centering pitfall**: WebKit ignores `<text>` `dominant-baseline="central"` (both attribute and CSS), falling back to alphabetic baseline; actor text in WKWebView sits ~0.35em high. `normalizeCentralBaseline` (mermaid.ts) rewrites central to alphabetic baseline + **absolute y shifted down 0.35em** (≈ font (ascent−descent)/2; dy cannot be added because actor text tspans carry `x`/`dy="0"`, anchoring coordinates and making text dy ineffective). Chromium/WebKit center consistently (13.6/13.4 vs 13.6/13.8). `middle` (messageText and other text without bounding boxes) is unchanged.
- **gitGraph branch-label vertical centering**: label text uses relative `<tspan dy="1em">`; system WKWebView resolves dy's em away from font-size (text sits ~4 units low in its chip; pixels measured 6.5px above vs 1.75px below; Chromium and Playwright WebKit are normal—**getBBox measures the font-metrics box, not the ink box, so probes must rasterize and measure pixels**, and chip background sampling must use the row mode to avoid strokes). Fix: `normalizeGitBranchLabels` (mermaid.ts) rewrites branch-label `dy="1em"` to **absolute y**, which is consistent across engines (font-size resolved through getComputedStyle, requires document attachment; fallback 16). Tags: probe method.
- **Related fix**: `MarkdownIt.prototype.utils.escapeHtml` in `createPlantUmlOnlineFallback` was an untouched bad reference (utils lives on the instance)—exposed by Mermaid error-state tests and changed to `md.utils.escapeHtml`.
- **Diagram placeholders are not wrapped in `<pre><code>` (text-clipping fix, 2026-08-17)**: the default fence rule wraps highlight output in `<pre><code>`, after which global `.markdown-body pre * { font-family: inherit !important }` forces monospace into SVG foreignObject text (Mermaid's injected `#id { font-family: … }` lacks !important and loses). Mermaid measures text in its temporary body container using its configured font (trebuchet ms…)—the render font is wider than the measurement font → text clips at foreignObject boundaries. Fix: parser.ts overrides `md.renderer.rules.fence`, emitting plantuml/mermaid placeholders directly (semantically they are not code), and the highlight callback no longer handles those languages. Export is fixed by the same route (inlining replaces the same placeholder string).

### Typography Enhancements (`==` / `^` / `~` / Emoji, 2026-08-18, Syntax Batch 5 / FR-023.4)

Supported in both editors (batch 5 in `docs/syntax-extensions-plan.md`; WYSIWYG implementation in `src/components/Editor/typographyPlugin.ts`):

- **Preview/export**: parser.ts chains four existing plugins through `.use()`—`markdown-it-mark` (`==`→`<mark>`), `markdown-it-sup` (`^`→`<sup>`), `markdown-it-sub` (single `~`→`<sub>`, naturally compatible with markdown-it's `~~` strikethrough), and the full `markdown-it-emoji` package (`:smile:`→unicode; code-region text untouched). mark/sup/sub have no official types, declared locally in `src/types/markdown-it-plugins.d.ts`.
- **Three custom WYSIWYG parts** (no mature community package; micromark layer modeled on micromark-extension-gfm-strikethrough 2.x):
  1. **pairedDelimiter micromark extension factory** (fixed-length paired delimiters: mark=`==`, sup=`^`, sub=`~`)—tokenizer recognizes only fixed-length runs (`=`/`===`/`^^` remain unparsed; after nok, “previous character is the same marker” prevents position-by-position retry mismatches); flanking rules match GFM strikethrough line by line (alphanumeric adjacency allows intra-word pairing `H~2~O`, whitespace adjacency rejects `== x ==`, punctuation adjacency requires non-whitespace on the other side); resolveAll is copied (closing run searches backward for opener, content reparses through insideSpan, unmatched runs degrade to data).
  2. **mdast fromMarkdown/toMarkdown**: mark/superscript/subscript nodes (children are inline containers; PM uses marks rather than nodes, simpler than admonition); toMarkdown handlers follow handleDelete (tracker + containerPhrasing always return original delimiters); `canContainEols` matches strikethrough.
  3. **PM $markSchema ×3 + input rules**: toDOM `<mark>/<sup>/<sub>`; markRule input rules convert when the closing delimiter is typed (following strikethroughInputRule, non-whitespace at content edges and no delimiter character inside).
- **Cost of assigning single `~` to subscript (key decision)**: the gfm preset's remarkGFMPlugin defaults to singleTilde: true (GitHub single-`~` deletion), conflicting with subscript. wysiwygPlugins filters remarkGFMPlugin and strikethroughInputRule by reference identity: the former re-registers with `{ singleTilde: false }` (same id `remarkGFM`; `~~` deletion unaffected—aligned with preview markdown-it recognizing only `~~`; GitHub single-`~` deletion becomes pandoc/Typora-style subscript throughout this app); the latter is replaced by a `~~`-only input rule (the original `(~{1,2})` converts single `~` to a strikethrough mark and serializes it as `~~`, rewriting user source). **Tokenizers for the same `~` character run in remark registration order**—remarkGFMNoSingleTilde must precede remarkTypographyPlugin (strikethrough claims `~~` first so single `~` reaches subscript).
- **Serialization escape strategy (prevent plain-text reparse misclassification through unsafe)**: `=` escapes only a second `=` immediately following another (`{ character: '=', before: '=' }`—a single `=` never forms a delimiter, `a = b` does not become `a \= b`; `a == b` serializes as `a =\= b`, and `=`+`\=` does not form a run on reparse); any single `^` can pair with another, so **all are escaped** (`a ^ b` → `a \^ b`); `~` is already covered by gfm strikethrough's existing unsafe (all escaped), with no duplication. notInConstruct follows strikethrough's list (no escaping inside autolink/destination*/reference/title*; `^` in link URLs remains literal).
- **Emoji is preview-only** (established decision): WYSIWYG displays literal `:smile:` shortcode text with zero modeling and zero round-trip risk; preview/PDF/site export render it.
- **Known cross-editor difference (pathological syntax, documented in examples/typography.md)**: overlong delimiters `===x===`/`^^x^^`—preview (markdown-it) parses the inner pair (`=<mark>x</mark>=`), while WYSIWYG keeps the entire run literal (fixed-length mismatch nok); round trips remain safe (unsafe escaping preserves literal text), and only rendering differs.
- **Tests**: 16 cases in `typographyRoundtrip.test.ts` (real PM marks rather than literal pass-through, flanking, escape stability, footnote `[^1]`/code regions/link destinations unaffected by `^`, fixed point); parser.test.ts +9 cases.
- **Styles**: `--mark-bg`/`--mark-text` theme variables shared by `.markdown-body mark` and `.wysiwyg-editor .ProseMirror mark` (sup/sub use browser-default rendering and need no styles).

### React 19: Unrelated Rerenders Reset dangerouslySetInnerHTML (2026-08-17)

**Symptom**: after preview zoom (or any unrelated store update), progressively rendered PlantUML/Mermaid SVG disappears and returns to loading placeholders.

**Root cause**: React 19 props diffing compares `dangerouslySetInnerHTML` by **object identity** (`nextProp === lastProp`), and `setProp` unconditionally performs `domElement.innerHTML = nextProp.__html`. An inline object literal `{{ __html: renderedHtml }}` is new on every render, so any Editor rerender (whole-store fields such as zoomLevel/cursorLine) resets preview DOM to placeholder HTML. The progressive-rendering effect does not depend on those fields and does not rerun, so diagrams disappear permanently (innerHTML setter trap + MutationObserver evidence; React 18 compared `__html` strings and did not have this problem).

**Fix** (Editor.tsx): `const previewHtmlProp = useMemo(() => ({ __html: renderedHtml }), [renderedHtml])`—stable identity makes React skip innerHTML rewriting. Regression test: `e2e/mermaid.spec.ts` “keeps rendered SVG after zoom in/out.” **Every feature that progressively/imperatively modifies preview DOM depends on this stability**; memoize the object for new `dangerouslySetInnerHTML` uses too.

### Markdown Extension Test Patterns

**Test Pattern for Container Plugins:**

```typescript
describe('parseMarkdown - Admonitions', () => {
  it('should render tip admonition', () => {
    const markdown = `::: tip\nThis is a tip.\n:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition tip">')
    expect(result).toContain('<div class="admonition-title">Tip</div>')
    expect(result).toContain('This is a tip.')
  })
})
```

**Test Pattern for PlantUML:**

```typescript
it('should render inline PlantUML as image', () => {
  const markdown = `@startuml\nAlice -> Bob: Hello\n@enduml`
  const result = parseMarkdown(markdown)
  expect(result).toContain('<div class="plantuml-diagram">')
  expect(result).toContain('plantuml.com/plantuml/svg')
})
```

---

## Editor Architecture

### WYSIWYG Architecture

> Created 2026-03-05
> Status: Phase 1 completed, Phase 2 pending

**Design**: Option A (four modes coexist, WYSIWYG is default)

Available modes: **WYSIWYG (default)**, Source, Preview, Split.

**Type definitions:**

```typescript
// editorStore.ts
viewMode: 'wysiwyg' | 'source' | 'preview' | 'split'

// Default mode
viewMode: 'wysiwyg' // Changed from 'source' to 'wysiwyg'
```

**Phase 1 file changes:**

| File | Change |
| --- | --- |
| `src/stores/editorStore.ts` | Extended ViewMode, changed default, persisted viewMode |
| `src/i18n/locales/en.json` | Added `toolbar.viewMode.wysiwyg`: "WYSIWYG" |
| `src/i18n/locales/zh-CN.json` | Added `toolbar.viewMode.wysiwyg`: "编辑" |
| `src/components/Toolbar/Toolbar.tsx` | Added WYSIWYG mode-switch button |
| `src/components/Editor/Editor.tsx` | Added WYSIWYG render branch (temporary placeholder) |

**Implementation phases:**

- Phase 1 ✅ (2026-03-05): Store type/default changes, mode-switch UI, i18n, test coverage
- Phase 2 ⏳: Markdown → HTML rendering (with position mapping), HTML → Markdown reverse conversion (turndown), basic editing sync
- Phases 3–7 📋: block elements (lists, code blocks, tables), inline styles and shortcuts, advanced features (images, Admonitions), optimization and tests

**Technical documents:**

- Research: [`wysiwyg-research.md`](./wysiwyg-research.md)
- Implementation plan: [`wysiwyg-implementation-plan.md`](./wysiwyg-implementation-plan.md)

**Pending decisions:**

| # | Question | Current status |
| --- | --- | --- |
| 1 | Toolbar-button behavior in WYSIWYG | Pending discussion |
| 2 | Shortcut design (`Cmd+/` toggle) | Pending implementation |
| 3 | Whether ProseMirror should replace contenteditable | Pending research |

### Outline Navigation (Click to Navigate from Outline)

1. **Extract Outline from Markdown**

   ```typescript
   // src/lib/outlineUtils.ts
   export interface OutlineItem {
     level: number // Heading level (1-6)
     text: string // Heading text
     lineIndex: number // Line number in content
     charIndex: number // Character position for textarea navigation
     index: number // Heading index for preview navigation
   }

   export function extractOutline(content: string): OutlineItem[]
   ```

2. **Navigation in Different View Modes**

   | Mode | Navigation Method | Implementation |
   | --- | --- | --- |
   | Source | Move CM selection + scroll scrollDOM | `scrollToCharIndex(view, charIndex)` |
   | Split | Move CM selection + scroll scrollDOM | `scrollToCharIndex(view, charIndex)` |
   | Preview | Scroll to heading element | `scrollPreviewToHeading(container, index)` |

3. **Component Communication via CustomEvent**

   ```typescript
   // Sidebar dispatches event
   window.dispatchEvent(
     new CustomEvent('editor-scroll-to-heading', {
       detail: { charIndex, lineIndex, index },
     })
   )

   // Editor listens and handles
   useEffect(() => {
     const handler = (e: CustomEvent) => {
       const { charIndex, index } = e.detail
       if (viewMode === 'preview') {
         scrollPreviewToHeading(previewContainer, index)
       } else {
         scrollToPosition(textarea, charIndex)
       }
     }
     window.addEventListener('editor-scroll-to-heading', handler)
   }, [viewMode])
   ```

4. **Important: Preview Mode Container Ref**
   Preview mode MUST have ref on the scrollable container:

   ```tsx
   // ✅ Correct
   <div ref={previewContainerRef} className="flex-1 overflow-auto">
     <div className="markdown-body" dangerouslySetInnerHTML={{ __html }} />
   </div>

   // ❌ Wrong - ref on inner content
   <div className="flex-1 overflow-auto">
     <div ref={previewRef} className="markdown-body">...</div>
   </div>
   ```

### Split View Sync Scrolling

**Challenge:** Bidirectional scroll synchronization between the source editor and div (preview). The editor-side scroll container is CodeMirror's `view.scrollDOM` (older textarea-era wording is obsolete).

1. **Ref Assignment**: Ensure refs point to scrollable containers, not inner content (same as above).

2. **Prevent Scroll Loop**: Use flag + timeout to prevent infinite recursion.

   ```typescript
   const isSyncingScroll = useRef(false)

   const handleSourceScroll = useCallback(() => {
     const sourceEl = cmView.scrollDOM // Editor scroll container: CodeMirror view.scrollDOM
     if (!isSyncingScroll.current && previewContainerRef.current) {
       isSyncingScroll.current = true

       // Calculate scroll percentage and apply to other side
       const scrollPercentage =
         sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1)
       previewContainer.scrollTop =
         scrollPercentage * (previewContainer.scrollHeight - previewContainer.clientHeight)

       // Release lock after short delay
       setTimeout(() => {
         isSyncingScroll.current = false
       }, 50)
     }
   }, [viewMode])
   ```

3. **Percentage-based Sync**: Scroll position is synchronized proportionally rather than absolutely, accommodating different content heights.

### Zoom

Editor content zoom is supported from 50% to 200% in 10% steps, with persisted state.

**Store state** (`editorStore.ts`):

```typescript
zoomLevel: number  // Default 100
setZoomLevel: (level: number) => void
zoomIn: () => void   // +10%, maximum 200%
zoomOut: () => void  // -10%, minimum 50%
zoomReset: () => void // Reset to 100%
```

**Applying zoom** in Source / Split / Preview / WYSIWYG:

- Editors (CodeMirror / WYSIWYG): font-size scaling—`fontSize = 14px × zoomLevel / 100` (CM reconfigures a compartment; WYSIWYG uses inline style); padding does not scale.
- Preview: CSS `zoom` (Editor.tsx `.markdown-body` container `style={{ zoom: `${zoomLevel}%` }}`).

**Shortcut handling:**

```typescript
if (isMod && (e.key === '=' || e.key === '+')) {
  e.preventDefault()
  zoomIn()
} else if (isMod && e.key === '-') {
  e.preventDefault()
  zoomOut()
} else if (isMod && e.key === '0') {
  e.preventDefault()
  zoomReset()
}
```

### Opening External Links (System Browser)

**Requirement:** clicking a Markdown link opens it in the system's default browser, not inside the VividMark window.

**Implementation:**

1. **Install dependency**

   ```bash
   pnpm add @tauri-apps/plugin-shell
   ```

2. **Rust backend configuration**
   - Add `tauri-plugin-shell = "2"` to `src-tauri/Cargo.toml`
   - Initialize in `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_shell::init())`
   - Add `"shell:default"` to `src-tauri/capabilities/default.json`

3. **Frontend implementation (Editor.tsx)**

   ```typescript
   import { open } from '@tauri-apps/plugin-shell'

   const handlePreviewClick = useCallback(async (e: React.MouseEvent) => {
     const target = e.target as HTMLElement
     const linkElement = target.closest('a[href]') as HTMLAnchorElement | null
     if (linkElement) {
       const href = linkElement.getAttribute('href')
       if (href) {
         e.preventDefault()
         try {
           await open(href)
         } catch (error) {
           console.error('Failed to open external link:', error)
         }
       }
       return
     }
   }, [])
   ```

**Key points:**

- Use `target.closest('a[href]')` to capture link clicks (including clicks on nested elements).
- **Always** call `e.preventDefault()` to prevent default navigation.
- The `shell:default` permission is essential; without it, the feature does not work.

---

## Sidebar File Tree Implementation

**File structure:**

```
src/
├── components/FileTree/
│   ├── FileTree.tsx        # Main file-tree component
│   ├── FileTreeItem.tsx    # Individual file/folder item
│   └── index.ts
├── hooks/useResizable.ts   # Drag-to-resize hook
└── lib/fileTreeUtils.ts    # File-tree utilities

src-tauri/src/lib.rs        # Rust backend read_directory command
```

**Key technical points:**

1. **Rust backend type mapping**

   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct FileTreeItem {
       pub name: String,
       pub path: String,
       #[serde(rename = "isDirectory")]  // Important: camelCase mapping
       pub is_directory: bool,
       pub children: Option<Vec<FileTreeItem>>,
   }
   ```

2. **Recursively expand all subdirectories**

   ```typescript
   const setAllExpanded = (items: FileTreeItem[], expanded: boolean): FileTreeItem[] => {
     return items.map((item) => ({
       ...item,
       isExpanded: item.isDirectory ? expanded : undefined,
       children: item.children ? setAllExpanded(item.children, expanded) : undefined,
     }))
   }
   ```

3. **Markdown file filtering**

   ```typescript
   export function filterMarkdownFiles(items: FileTreeItem[]): FileTreeItem[] {
     return items
       .filter((item) => {
         if (item.isDirectory) return true
         return (
           item.name.endsWith('.md') ||
           item.name.endsWith('.markdown') ||
           item.name.endsWith('.txt')
         )
       })
       .map((item) => ({
         ...item,
         children: item.children ? filterMarkdownFiles(item.children) : undefined,
       }))
   }
   ```

4. **Drag-to-resize hook**
   ```typescript
   export function useResizable({
     initialWidth,
     minWidth = 200,
     maxWidth = 500,
     onResize,
   }: UseResizableOptions)
   ```

**UI elements:**

- Tab switcher (Outline / File Tree)
- Folder titlebar (folder name + close button)
- File items (expand/collapse indicator + file icon + filename)
- Drag handle (right edge, shown on hover)

**Default behavior:**

- Show only Markdown/txt files and folders by default (`showMarkdownOnly = true`)
- All folders expanded by default
- Click folders to toggle expansion
- Click files to open (confirm if unsaved changes exist)
- Highlight the currently open file

---

## Toolbar Layout (2026-03-06)

**Goal:** reduce excessive toolbar buttons and crowding through sensible grouping.

**Layout adjustments:**

- **Left**: file actions (New, Open, Save) + undo/redo
- **Center**: core formatting tools + view switcher
- **Right**: zoom controls + language/theme settings

**Feature groups:**

| Button group | Features |
| --- | --- |
| Basic formatting | Bold, italic |
| Heading dropdown | H1/H2/H3 in one dropdown |
| Lists | Unordered list |
| Insert menu | Image, table, code block (dropdown) |
| More formatting | Strikethrough, inline code, link, ordered list, task list, quote (dropdown) |

**New components:**

- `HeadingDropdown.tsx` — heading-level dropdown, Props: `onSelect: (level: 1 | 2 | 3) => void`
- `InsertMenu.tsx` — insertion dropdown, Props: `onImage, onTable, onCodeBlock`
- `FormatMenu.tsx` — additional formatting dropdown, Props: `onFormat: (format: FormatType) => void`

**Window title:**

- Filename moved out of the toolbar and into the window titlebar.
- Format: `filename ● - VividMark` (● indicates unsaved changes).
- Titles must use the `set_window_title` Rust command (`src-tauri/src/titlebar.rs`, which explicitly rearranges traffic lights after setting a title); **frontend code must not call setTitle from `@tauri-apps/api/window` directly**—that triggers AppKit to return traffic lights to their default y (see “2026-08-14 macOS Traffic Lights” near the end).
- `core:window:allow-set-title` is non-default in Tauri 2.10+ and must be granted explicitly in capabilities; without it, ACL silently denies IPC and the title remains the conf initial value (this once made every Dock window list entry display "VividMark").

**Language selector:**

- Emoji flags (🇺🇸 🇨🇳) could render incorrectly on Windows, so text labels `EN` / `中` replaced them.
- The data structure adds a `label` field:
  ```typescript
  { code: 'en', name: 'English', flag: '🇺🇸', label: 'EN' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳', label: '中' }
  ```

**View switcher:** four compact text buttons use background color for active state, ordered WYSIWYG | Source | Split | Preview.

---

## Windows Path Handling

**Background:**
Windows uses `\` as its path separator, while Unix/macOS uses `/`. Cross-platform path handling must normalize both to avoid parsing errors.

**Affected scenarios:**

1. **Image insertion** - relative-path calculation (`src/lib/imageUtils.ts`)
2. **Markdown rendering** - resolving relative to absolute paths (`src/lib/imageSrc.ts`, called by parser.ts)
3. **baseDir calculation** - extracting directories from file paths (`src/components/Editor/Editor.tsx`)

**Solution:**
Convert paths to POSIX style (`/`) before processing:

```typescript
// Normalize to POSIX-style paths
const normalizedPath = windowsPath.replace(/\\/g, '/')

// Handle path separators (Windows and Unix)
const lastSlash = filePath.lastIndexOf('/')
const lastBackslash = filePath.lastIndexOf('\\')
const separatorIndex = Math.max(lastSlash, lastBackslash)
```

**Key functions:**

- `getRelativePath()` - calculate relative paths (imageUtils.ts)
- `resolveRelativePath()` - resolve relative to absolute paths (imageSrc.ts)
- baseDir calculation in Editor.tsx

**Notes:**

- A Windows absolute path such as `C:\Users\...` becomes `C:/Users/...`, which Tauri APIs handle correctly.
- `../` and `./` in relative paths remain unchanged by conversion.

---

## PDF Export in Detail

Typora-style direct save: save dialog → silently generate a PDF, with no print dialog.

### Workflow

1. **Trigger** - native menu `export-pdf` (Cmd/Ctrl+P) / MoreMenu / Preview context menu all dispatch `editor-export-pdf` → `Editor.tsx` listens and calls `exportCurrentDocument()`.
2. **Platform check** - `pdf_export_supported` command (macOS checks `WKWebView.printOperationWithPrintInfo` availability; Windows always true; Linux false). Unsupported platforms fall back directly to the `print_pdf` print dialog.
3. **Save dialog** - frontend `@tauri-apps/plugin-dialog` `save()`, defaulting to `<filename>.pdf`.
4. **Generate export HTML** (`src/lib/exportPdf.ts buildPdfExportHtml`):
   - Render through `parseMarkdownAsync(content, { baseDir })` (same pipeline as preview; local images read and inlined as base64 data URLs).
   - Serialize `document.styleSheets` + `adoptedStyleSheets` into inline `<style>` (complete Tailwind/hljs/.markdown-body styles, pixel-matched to preview; no `.dark` class → PDF is always light).
   - Append export-only CSS (`@page` margins, `page-break-inside: avoid`, `print-color-adjust: exact` to retain backgrounds, etc.).
5. **Rust rendering and disk write** (`src-tauri/src/pdf.rs export_pdf_file`):
   - Export jobs queue serially through a tokio Mutex; HTML is stored in a global slot.
   - Create a hidden `WebviewWindow` (label `pdf-export`, 800×1132), loading slot HTML through custom protocol `vividmark-pdf://localhost/export.html` (`http://vividmark-pdf.localhost/...` on Windows).
   - `on_page_load` Finished (≈ load event, including images and other subresources) → start printing; a 15s timeout continues anyway (missing a remote image is better than failing).
   - Native platform print-to-PDF writes the target path, then `destroy()`s the window and clears the slot.

### Platform Implementations

| Platform | Mechanism | Notes |
| --- | --- | --- |
| macOS | `WKWebView.printOperationWithPrintInfo:` + `NSPrintSaveJob` + `NSPrintJobSavingURL` (objc2) | Requires macOS 11+, otherwise falls back |
| Windows | WebView2 `ICoreWebView2_7::PrintToPdf` (webview2-com) | Requires Runtime 1.0.1518.46+; cast failure falls back |
| Linux | Unsupported (webkit2gtk 2.0 does not bind `print_to_pdf`) | `pdf_export_supported` false → print dialog |

### Key macOS Pitfalls (Spike Measurements, macOS 26)

- **`createPDFWithConfiguration:` is unsuitable**: it produces a single long screenshot-like page with no pagination.
- **A fresh `NSPrintInfo()` + `runOperation()` causes infinite pagination** (page count explodes and the file grows linearly to GB scale).
  Replicate wry's print mode: `NSPrintInfo.sharedPrintInfo().copy()` (includes valid paper) +
  `canSpawnSeparateThread(true)` + `runOperationModalForWindow:delegate:didRunSelector:contextInfo:`.
  Completion arrives through delegate `printOperationDidRun:success:contextInfo:` (contextInfo carries a oneshot sender + retained delegate for lifetime).
- Rust-side `NSPrintInfo` sets 15mm margins (42.52pt); paper follows system region (A4/Letter).
- Hidden windows (never orderFront) print correctly; background colors require CSS `print-color-adjust: exact`.

### Windows Notes

- `PlatformWebview.controller()` → `CoreWebView2()` → `cast::<ICoreWebView2_7>()`;
  print settings use `environment()` cast to `ICoreWebView2Environment6` → `CreatePrintSettings()` (enable `ShouldPrintBackgrounds`, margins 0.59in ≈ 15mm).
- Completion callback uses `PrintToPdfCompletedHandler::create` (macro-generated by webview2-com), checking both `HRESULT + BOOL`.

### Fallback and Error Handling

- If `export_pdf_file` returns an `error` beginning with `unsupported`, frontend automatically falls back to `print_pdf` (print dialog).
- Other failures → `alertDialog(t('messages.exportPdfFailed'))`; cancelling the save dialog is silent.
- Browser dev / E2E (without Tauri) → `window.print()`.

### Implementation Files

| File | Purpose |
| --- | --- |
| `src-tauri/src/pdf.rs` | `export_pdf_file` / `pdf_export_supported` commands + protocol handler |
| `src-tauri/src/lib.rs` | Protocol registration + `print_pdf` (fallback, unchanged) |
| `src/lib/exportPdf.ts` | Frontend export orchestration + HTML generation + fallback logic |
| `src/components/Editor/Editor.tsx` | Listens for `editor-export-pdf` |

### Pagination CSS Findings (Debugging Against Typora)

- **Printed images must be block-level and height-constrained**: WebKit may apply `page-break-inside: avoid` to an inline `img` by leaving a page-break placeholder without drawing the image; export CSS fixes this with `display: block`. Also set `max-height: 360px` + `width/height: auto` to scale tall screenshots proportionally, reducing large blank areas caused by pushing a whole image to the next page (a real 17-image document dropped from 16 to 14 pages, with the first image restored).
- **Never apply whole-table `page-break-inside: avoid` to long tables**: a table exceeding remaining page space moves entirely to the next page, leaving a large blank area (the main reason for 6 pages vs Typora's 3). Correct approach: allow tables to cross pages + `tr/td/th { break-inside: avoid }` + `thead { display: table-header-group }` (repeat headers automatically across pages).
- **WebKit engine limitation**: multiline table rows can still split inline content at page boundaries (`break-inside` does not work on tr; long unsupported in WebKit; Chromium/WebView2 behaves correctly). Larger line heights hit this more often; currently accepted.
- **Trailing blank page**: `.markdown-body > :last-child` margins overflow into a blank page when content exactly fills a page; export CSS needs `margin-bottom: 0`.
- **Application-shell styles must reset**: serialized global CSS includes `html, body, #root { height: 100% }`, which must be overridden with `height: auto !important; overflow: visible !important`.
- **Print density is independent of preview**: export CSS overrides `font-size: 14px` (preview 16px), `td/th padding: 6px 10px`, and `.markdown-body padding: 0`; `th` + first column use `white-space: nowrap` to keep short columns from wrapping under pressure from content columns (a long-paragraph first column widens the table, an accepted tradeoff).
- **Long code-line wrapping**: application `.hljs code { white-space: pre !important }` prevents wrapping and clips code at `pre` boundaries; export CSS uses an equally specific but later `pre code / pre.hljs code / code.hljs` selector group to override with `pre-wrap !important; word-break: break-all !important`.
- **Images clipped on the right inside tables**: WebKit resolves the percentage base of an in-cell `img { max-width: 100% }` against the padding box rather than content box, making the image wider by 10px of left/right padding, then clipping it through the table's rounded-corner `overflow: hidden`. Fix: `td:has(> img) { padding-left/right: 0 }` (content box = padding box).
- **Missing right border on full-width tables**: WebKit printing clips at the printable page boundary; collapsed-grid right/bottom outer borders extend half a border width outward (a 100%-width table reaches the boundary exactly), so the right border is clipped to a nearly invisible half-width (screen subpixels keep preview normal). Fix: export CSS `table { width: calc(100% - 2px) !important }`.

### PDF Bookmark Outline (macOS Post-Processing)

WebKit printing generates no PDF outline (Chromium generates one automatically, so Windows needs no handling). After successful macOS printing, **PDFKit post-processing** runs: frontend extracts headings from rendered HTML (`extractPdfOutline`, DOMParser + textContent, matching PDF text) → `export_pdf_file` carries `outline: [{text, level}]` → `add_pdf_outline`:
each page's `PDFPage.string()` is normalized and inclusion-matched against headings (page cursor moves monotonically forward; repeated headings are located in order), a stack builds the level tree into `outlineRoot`, and `writeToURL:` overwrites the file.

**Major WebKit PDF text-extraction pitfall**: some Han characters map to **compatibility ideographs** (八→⼋ U+2F08, foldable through NFKC) or **Kangxi radical supplement characters** (风→⻛ U+2EDB、门→⻔ U+2ED4; U+2E80–U+2EFF has **no** Unicode decomposition mapping, so NFKC cannot fold them), and spaces are inserted at CJK/Latin boundaries. Therefore PDFKit `findString:` exact matching is unreliable. Required: NFKC normalization + remove all whitespace + treat radicals/compatibility characters on the haystack side as single-character wildcards (`pdf_text_contains`).

---

## Logging

### Frontend Logging

```typescript
import { createLogger, fileOpsLogger } from './lib/logger'

fileOpsLogger.info('Operation completed', { path: filePath })
fileOpsLogger.error('Operation failed', error)

// Or create custom module logger
const myLogger = createLogger('MyModule')
myLogger.debug('Debug info')
myLogger.time('operation')
myLogger.timeEnd('operation')
```

Log levels: `debug` < `info` < `warn` < `error`

- Development: All levels shown
- Production: Only `error` level

### Backend (Rust) Logging

The Rust backend uses `tauri-plugin-log` for structured logging with comprehensive diagnostics.

**Log Features:**

- **Operation tracing**: All file operations log start, progress, and completion
- **Performance metrics**: Each operation logs elapsed time and throughput (MB/s)
- **File metadata**: Logs file size, permissions, and modification time
- **Error context**: Detailed error messages with error kind classification
- **System info**: Startup logs include platform, architecture, and paths

**Log Locations:**

- Development: Console (stdout) + log file
- Production: Log file only

**Log File Location:**

- macOS: `~/Library/Logs/com.vividmark.app/`
- Windows: `%APPDATA%\com.vividmark.app\logs\`
- Linux: `~/.local/share/com.vividmark.app/logs/`

**Example Log Output:**

```
[14:32:01] [System] VividMark Backend Starting
[14:32:01] [System] Platform: macOS
[14:32:15] [read_file] Target path: /Users/xxx/Documents/test.md
[14:32:15] [read_file] ✓ Success: /Users/xxx/Documents/test.md (15234 bytes, 1234 chars) in 2.1ms (~7.12 MB/s)
```

---

## Tauri Commands

Defined in `src-tauri/src/lib.rs` (PDF export in `src-tauri/src/pdf.rs`, site export in `src-tauri/src/site_export.rs`, multi-window routing in `src-tauri/src/window_router.rs`, and window titles in `src-tauri/src/titlebar.rs`):

| Command | Parameters | Returns | Description |
| --- | --- | --- | --- |
| `read_file` | `path` | `FileInfo` | Read file content |
| `save_file` | `path, content` | `SaveResult` | Write file content |
| `file_exists` | `path` | `bool` | Check existence |
| `read_directory` | `ReadDirectoryParams` | `FileTreeItem[]` | File tree data |
| `create_file` | `path` | `null` | Create empty file |
| `create_folder` | `path` | `null` | Create directory |
| `rename_path` | `oldPath, newPath` | `null` | Rename/move file or folder |
| `delete_path` | `path` | `null` | Delete (folder: recursive) |
| `copy_path` | `oldPath, newPath` | `null` | Copy (folder: recursive) |
| `reveal_in_folder` | `path` | `null` | Reveal in system file manager |
| `pdf_export_supported` | — | `bool` | Whether the platform supports direct PDF saving (supported on macOS/Windows) |
| `export_pdf_file` | `params(ExportPdfFileParams)` | `ExportPdfResult` | Hidden-window rendering → native print-to-PDF silent file write; params fields `{ html, outputPath, title?, outline? }` (when outline is present, macOS rebuilds PDF bookmarks) |
| `print_pdf` | `fileName` | `ExportPdfResult` | Print dialog (fallback when direct PDF saving is unsupported) |
| `export_site` | `params(outputDir,files)` | `ExportSiteResult` | Batch disk writes for Export as Website (text writes + mirrored asset copies) |
| `rebuild_menu` | `lang, recentFiles` | `null` | Rebuild native menu (i18n / recent files) |
| `set_menu_item_enabled` | `id, enabled` | `null` | Native menu item enabled state |
| `set_menu_item_checked` | `id, checked` | `null` | Native menu check item state |
| `update_dock_menu` | `lang, recentFiles` | `null` | Rebuild macOS Dock menu (no-op on other platforms) |
| `report_window_state` | `path, dirty` | `null` | Frontend reports this window's document state (window registry) |
| `open_in_new_window` | `path?` | `String`(label) | Create document window (file-new / routed creation) |
| `route_open` | `paths` | `null` | Smart open-path routing (focus/reuse/create) |
| `take_startup_open_files` | `label?` | `String[]` | Drain this window's startup open queue (passing None clears every window's queue—known pitfall) |
| `set_window_title` | `title` | `null` | Set window title and rearrange traffic lights |
| `quit_app` | — | `null` | Quit by closing each window through dirty confirmation (`file:exit`, lib.rs) |
| `watch_file` | `path` | `null` | Watch parent directory per window and filter target file (file_watch.rs, 300ms debounce) |
| `unwatch_file` | — | `null` | Stop this window's file watcher (file_watch.rs) |

To add a command: implement `#[tauri::command]` → register it in `generate_handler![]` → invoke it from the frontend through `@tauri-apps/api/core`. Struct fields cross the bridge as camelCase (`#[serde(rename = "isDirectory")]`).

## Keyboard Shortcuts

On macOS/Linux desktop, keys with accelerators are intercepted by the OS (the webview receives no keydown), so native menu events drive those shortcuts. **On Windows desktop (no native menubar) and in browser dev/E2E, `useKeyboardShortcuts.ts` handles the full set** (keys already handled by editor keymaps are skipped through the `e.defaultPrevented` guard).

| Shortcut | Action | Implementation |
| --- | --- | --- |
| `Cmd/Ctrl + O / S / Shift+S` | Open / Save / Save As | Native menu (macOS/Linux) / `useKeyboardShortcuts.ts` (Windows/browser) |
| `Cmd/Ctrl + N` | New **window** (multi-window SDI) | Native menu (macOS/Linux) → open_in_new_window; same route through Windows desktop hook; browser creates in place |
| `Cmd/Ctrl + Shift+O` | Open Folder | Native menu (macOS/Linux) / `useKeyboardShortcuts.ts` (Windows/browser) |
| `Cmd/Ctrl + /` | WYSIWYG ⇄ Source toggle | `useKeyboardShortcuts.ts` (intentionally not in menu—placing it beside view-mode check items is confusing; no desktop accelerator occupies it, so keydown reaches the webview directly) |
| `Cmd/Ctrl + B / I / K` | Bold / Italic / Link | Native menu (macOS/Linux) → editor-format; Windows/browser hook → editor-format (Milkdown's own Mod-B/I keymaps take priority) |
| `Cmd/Ctrl + 0` | Body text (strip block prefix) | Native menu (macOS/Linux) / hook → editor-format |
| `Cmd/Ctrl + 1 ~ 6` | Heading 1 ~ 6 | Native menu (macOS/Linux) / hook → editor-format; browser additionally has CM keymap / `wysiwygShortcutPlugin` (1–3 only) |
| `Cmd/Ctrl + Alt+Q / U / O / X / C` | Quote / unordered / ordered / task list / code block | Native menu (macOS/Linux) / hook → editor-format |
| `Cmd/Ctrl + Shift+V` | Paste as plain text | Native menu (macOS/Linux) / hook → clipboard text read → editor-insert |
| `Cmd/Ctrl + Z / Shift+Z` | Undo / Redo | Native menu (macOS/Linux) / hook → editor-undo/redo; CM / Milkdown history keymaps take priority inside editors (defaultPrevented guard) |
| `Cmd/Ctrl + F` | Find & replace | Native menu (macOS/Linux) / hook → editor-find → `@codemirror/search` (CM's own Mod-F takes priority) |
| `Cmd/Ctrl + = / -` | Zoom in / out | Native menu (macOS/Linux) / hook (Editor.tsx's old window-level zoom listener was merged, no duplication) |
| `Cmd/Ctrl + Shift+0` | Zoom reset (⌘0 yielded to Body Text) | Native menu (macOS/Linux) / hook |
| `Cmd/Ctrl + ,` | Settings | Native menu (macOS/Linux) / hook |
| `Cmd/Ctrl + Shift+B` | Toggle Sidebar | Native menu (macOS/Linux) / hook |
| `Ctrl+Cmd + 1 / 2` (macOS only) | Sidebar Files / Outline tab | Native menu (View check items) |
| `Cmd/Ctrl + Alt+1~4` | WYSIWYG / Source / Split / Preview | Native menu (macOS/Linux) / hook |
| `Cmd/Ctrl + P` | Export PDF | Native menu (macOS/Linux) / hook → editor-export-pdf / `MoreMenu` |
| `Cmd/Ctrl + Q` / `Cmd+W` | Quit app / close window | Q: Linux custom `file:exit` → `quit_app` (close each window through dirty confirmation), macOS predefined Quit; W: macOS predefined Close Window |
| `F11` | Toggle fullscreen | macOS predefined Fullscreen; Linux custom `view:fullscreen`; Windows hook + custom menu (View ▸ Fullscreen) |
| `Escape` | Close dialog/menu/image viewer | Each component handles its own (Dialog/MenuPanel/ImageLightbox); inside editors, exits math and code-block-language inline editing (no global “exit editing mode” binding—the block-editor-era leftover was removed) |

---

## CI/CD and Release

### CI Workflow (test.yml)

1. **Lint job**: ESLint + Prettier check
2. **Typecheck job**: TypeScript compilation check
3. **Unit Tests job**: Vitest with coverage reporting to Codecov
4. **E2E Tests job**: Currently disabled (requires Tauri setup)

### GitHub Actions Automatic Build and Release (release.yml)

**Features:**

- Pushing a `v*` tag automatically triggers a build; manual dispatch is also supported.
- Parallel multi-platform builds: macOS (Apple Silicon), Windows (x64), Linux (x64, deb + AppImage).
- Linglong arm64 build: `build-linglong` job (`ubuntu-24.04-arm` runner) builds `.layer`/`.uab` with the tag and attaches them to the Release (manual dispatch only uploads an artifact; see `linglong/README.md`).
- Automatic upload to GitHub Releases (tauri-action creates a **draft** Release).

**Trigger:**

```bash
git tag v0.1.1
git push origin v0.1.1
```

**Workflow configuration notes:**

- Rust toolchain uses `dtolnay/rust-toolchain@stable` (not `rust-action`).
- Ubuntu requires `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`.
- `pnpm install --frozen-lockfile`.
- Builds use `tauri-apps/tauri-action@v0`, automatically creating a draft Release.
- macOS uses Developer ID Application signing and Hardened Runtime; after Tauri completes App notarization, the workflow separately notarizes the DMG, staples/validates it, and uses `gh release upload --clobber` to replace the unstapled DMG in the draft.

**Common issues and solutions:**

1. **TypeScript compilation error** (`TS6133: 'match' is declared but its value is never read`)
   - CI uses strict mode; prefix unused variables with an underscore, such as `_match`.

2. **macOS “App is damaged” warning**
   - Official Releases have Developer ID signing and Apple notarization and should not show this warning.
   - A self-built unsigned version can temporarily bypass Gatekeeper with `xattr -rd com.apple.quarantine /Applications/VividMark.app`.

**macOS signing/notarization secrets:**
`APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY` / `APPLE_API_ISSUER` / `APPLE_API_KEY` / `APPLE_API_KEY_CONTENT`

> `APPLE_CERTIFICATE` is the Base64 form of a `.p12`; `APPLE_API_KEY_CONTENT` is App Store Connect API `.p8` content. The workflow restores temporary key files only on the macOS runner, then verifies the signature, Hardened Runtime, Gatekeeper assessment, and DMG notarization ticket after building.

**Notes:**

- Unsigned Windows apps show a SmartScreen warning.
- Linux needs no signing, but installing `.deb` packages requires administrator privileges.

### GitHub Release Process

**Version management** (all three must stay synchronized):

- `package.json` - frontend version
- `src-tauri/tauri.conf.json` - Tauri app version
- `src-tauri/Cargo.toml` - Rust crate version

**Main release flow (push tag → CI creates draft → verify artifacts → publish manually):**

```bash
# 1. Ensure version numbers are updated
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to X.Y.Z"

# 2. Create and push tag
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z

# 3. CI (release.yml) automatically builds all platform artifacts and creates a draft Release (including Linglong arm64 .layer/.uab)

# 4. Verify all artifacts in GitHub Releases, add release notes, then publish manually
```

**Fallback path (local build + manual Release when CI is unavailable):**

> ⚠️ If CI has already created a draft for the same tag, `gh release create` conflicts because the tag exists—delete CI's draft on the Releases page before running this.

```bash
# 1. Build release (macOS example)
pnpm tauri build

# 2. Create GitHub Release and upload build artifacts
gh release create vX.Y.Z \
  --title "VividMark vX.Y.Z" \
  --notes "Release notes here" \
  --draft=false \
  --prerelease=false \
  "src-tauri/target/release/bundle/dmg/VividMark_X.Y.Z_aarch64.dmg"
```

**Build artifact locations:**

| Platform | Artifact type | Path |
| --- | --- | --- |
| macOS | .app bundle | `src-tauri/target/release/bundle/macos/VividMark.app` |
| macOS | .dmg installer | `src-tauri/target/release/bundle/dmg/VividMark_X.Y.Z_aarch64.dmg` |

### Documentation Internationalization (README / GitHub Pages)

**README dual-version structure:**

```
README.md          # English (primary file)
README.zh-CN.md    # Simplified Chinese
```

**README language-switch link format:**

```markdown
<!-- Top of README.md -->

**English | [简体中文](README.zh-CN.md)**

<!-- Top of README.zh-CN.md -->

**[English](README.md) | 简体中文**
```

**GitHub Pages dual-version structure:**

```
docs/
├── index.html          # English home page
├── index.zh-CN.html    # Simplified Chinese home page
├── css/style.css       # Shared styles (including .lang-switch language switcher)
└── images/             # Shared assets
```

**Synchronized-update checklist (must be edited in pairs):**

- `README.md` ↔ `README.zh-CN.md`
- `PLAN.md` ↔ `PLAN.zh-CN.md`
- `AGENTS.md` ↔ `AGENTS.zh-CN.md`
- `docs/implementation-notes.md` ↔ `docs/implementation-notes.zh-CN.md`
- `docs/DESIGN_SYSTEM.md` ↔ `docs/DESIGN_SYSTEM.zh-CN.md`
- `docs/index.html` ↔ `docs/index.zh-CN.html`

### GitHub Pages Deployment

- Static files live in `docs/`; the workflow is `.github/workflows/pages.yml`.
- It uses `actions/configure-pages@v5` + `actions/upload-pages-artifact@v5` (path: `./docs`) + `actions/deploy-pages@v5`.
- Repository Settings → Pages → Source must be **GitHub Actions** (not "Deploy from branch"), or the Setup Pages step fails.
- A 404 immediately after deployment may be CDN propagation delay; wait 1–2 minutes.

---

## Git Repository Management

### File Types That Should Not Be Committed

| Category | Examples | Reason |
| --- | --- | --- |
| **Generated files** | `coverage/`, `dist/`, `*.log` | Regenerated by every build |
| **Test reports** | `test-results/`, `playwright-report/` | CI-generated; no version control needed |
| **Dependency directories** | `node_modules/`, `src-tauri/target/` | Installed through package managers |
| **Local configuration** | `.claude/`, `.idea/`, `.vscode/` | Personal development settings |
| **Sensitive information** | `.env`, `*.token`, `*.key` | Security risk |
| **System files** | `.DS_Store`, `Thumbs.db` | OS-generated |

### Inspection and Cleanup

```bash
# Find files that should not be committed
git ls-files | grep -E "(coverage|test-results|\.claude|node_modules|dist)"

# Cleanup: add to .gitignore first, then remove from Git (keep local files)
git rm -r --cached coverage test-results
git add .gitignore
git commit -m "chore: remove generated files"
```

### Best Practices

1. **Configure `.gitignore` when initializing a project**.
2. **Check `git status` regularly** for omissions.
3. **Review before committing** with `git diff --cached --name-only`.
4. **Large files already committed** can be removed from history with `git filter-branch` or BFG Repo-Cleaner.
5. **If sensitive information leaks**, rotate credentials immediately, clean history, and enable secret scanning.

---

## Typst Offline Support

> **Detailed task plan**: [`typst-offline-plan.md`](./typst-offline-plan.md) (complete nine-phase checklist)

**Status**: ⏸️ Start after current high-priority tasks (created 2026-03-02)
**Estimated effort**: 2–3 weeks (full feature) / 1 week (MVP)

**Requirement:** add Typst rendering to VividMark, available offline or on weak networks.

**Technical approach:**

- Use `@myriaddreamin/typst.ts` for the JavaScript API.
- Bundle WASM files locally (compiler + renderer, about 5MB).
- Bundle fonts locally (minimal set about 1MB; roughly 15–20MB with CJK fonts).
- Host through Tauri's resource directory with zero external CDN dependencies.

**Implementation notes:**

```typescript
// Local WASM loading configuration
$typst.setCompilerInitOptions({
  getModule: () => '/typst/typst_ts_web_compiler_bg.wasm',
  getFontAssets: () => ['/typst/fonts/'],
})

// Code-block rendering
if (lang === 'typst') {
  const svg = await $typst.svg({ mainContent: code })
  return `<div class="typst-render">${svg}</div>`
}
```

**Pending decisions:**

| # | Question | Recommended approach |
| --- | --- | --- |
| 1 | CJK support strategy | Start with system fonts; optional bundling later |
| 2 | WASM loading timing | Lazy-load (on first Typst use) |
| 3 | Font fallback | Permissive fallback (UX first) |
| 4 | Cache strategy | Start with an in-memory cache |

---

## 2026-08-04 CodeMirror 6 Editor Foundation (UX Improvements P0/P1)

> Background and complete plan: `docs/ux-improvement-plan.md`; task board: PLAN.md “Phase 13”.

### Architecture Notes

- **Editor core**: all Source/Split textareas were replaced by CodeMirror 6, wrapped in `src/components/Editor/CodeMirrorEditor.tsx`. The WYSIWYG placeholder remained unchanged (Editor.tsx wysiwyg branch).
- **Formatting logic is pure**: `src/lib/markdownEditing.ts` (`formatTransaction` / `insertTextAtCursor`) receives EditorState and returns TransactionSpec; toolbar `editor-format` events and shortcuts (Mod-B/I/K/1/2/3, `Prec.highest` keymap) share it and can be unit-tested without DOM.
- **Store ↔ CM loop prevention**: updateListener compares `value !== store.content` before writing the store; store → CM full replacement compares similarly. The view is keyed by `filePath`, so opening a new file naturally resets CM history.
- **Undo**: CM history (operation grouping, selection restoration) replaced the old 500ms full-document-snapshot HistoryManager (`useHistory`/`useTextFormat`/`historyManager` deleted). `canUndo`/`canRedo` write to the store to drive toolbar disabled state.
- **Smart input**: `markdownKeymap` (Enter continues lists/tasks/quotes, empty item exits), `indentWithTab`, `closeBrackets`.
- **Find and replace**: `@codemirror/search` (`search({ top: true })`), with light/dark panel styles appended to globals.css.
- **Image paste/drag**: `domEventHandlers` paste/drop → `imageUtils.createImageMarkdownFromFile` (saved files copy into `assets/` and use relative paths; unsaved files fall back to base64); drop uses `posAtCoords` to locate insertion.
- **Preview debounce**: 120ms rendering (Editor.tsx), 200ms outline/word count (`useDebouncedValue` + shared algorithm in `src/lib/textStats.ts`, used by Sidebar and status bar).
- **Status bar**: `src/components/StatusBar/StatusBar.tsx`; cursor line/column reported through non-persisted store fields `cursorLine/cursorCol`.
- **Components stay mounted**: CodeMirrorEditor is merely `hidden` in preview/wysiwyg modes, preserving undo history and toolbar events across modes.

### Pitfalls

- **CM6 in jsdom needs polyfills**: `Range.prototype.getClientRects/getBoundingClientRect`, `scrollIntoView`, etc.; see `src/test/setup.ts`.
- **E2E selectors**: textarea → `.cm-content`; read editor content with `innerText()` + `expect.poll` (CM is not a form control and has no value).
- **Zoom implementation changed**: from textarea CSS `zoom` to font-size scaling (14px × zoomLevel/100); padding no longer scales.
- **Remaining**: two cases in `e2e/drag-drop.spec.ts` depend on Tauri window-level drag events/native file dialogs and cannot pass in browser-only E2E (they failed before this work too; unrelated to CM); preview checkbox clicks move the CM cursor to document end (accepted); OS-level image drag-in was not tested in the Tauri runtime.

---

## 2026-08-04 WYSIWYG Implementation (Milkdown, UX Improvement P2)

### Architecture Notes

- **Core**: WYSIWYG uses Milkdown v7 (ProseMirror), headless (no `@milkdown/react`; all nodeviews pure DOM), component `src/components/Editor/WysiwygEditor.tsx`, plugin collection `wysiwygPlugins.ts`. **`@milkdown/kit` root exports are empty; subpath imports are required** (`@milkdown/kit/core`, `/preset/gfm`, `/utils`, `/prose/*`).
- **Synchronization model**: Markdown source is the single source of truth. Edits → `listener.markdownUpdated` serializes back to the store (200ms debounce, equal values skipped, writes only while WYSIWYG active); external changes → `replaceAll(content, flush=true)` rebuilds EditorState (produces no transaction and therefore no write-back—**the initial dirty-mark guard depends on this**, with tests locking that opening files/switching modes does not mark dirty). The editor instance is keyed by `filePath`.
- **viewMode routing**: CM and Milkdown both stay mounted (inactive hidden). Event handlers on both sides (`editor-format`/`editor-insert`/`editor-undo`/`editor-redo`) and `canUndo/canRedo` writes are gated by `viewMode`—CM gating is essential: while typing in WYSIWYG, store→CM sync triggers CM listeners and would otherwise overwrite Milkdown's reported undo depth.
- **Lossless Markdown round trips**: unknown syntax degrades while preserving source (admonition→literal paragraphs, plantuml→code block), with second-round-trip fixed-point tests. First entry normalizes once (`-`→`*`, bare URL→`<url>`, etc.; semantically equivalent and inherent to WYSIWYG).
- **Custom syntax**:
  - **Admonition**: `admonitionPlugin.ts` (`$remark` mdast transform + remark-stringify handler) + schema + `admonitionView.ts` (reuses preview `.admonition` CSS). Two pitfalls: ① commonmark remarkLineBreak merges soft breaks, so the transform must run after it and split merged paragraphs; ② admonition schema must not register before paragraph (PM createAndFill recurses into stack overflow).
  - **PlantUML / Mermaid**: `plantUmlCodeBlockView.ts`—`$view(codeBlockSchema.node)` dispatches by `language` attr (plantuml/mermaid) to render “preview + editable source”; encoding shares `src/lib/plantuml.ts` / `src/lib/mermaid.ts` (parser.ts already calls these). See “Mermaid (2026-08-17)” above for integration details.
  - **Local images**: `imageView.ts`—changes only DOM src while node attrs retain source (lossless serialization); resolution shares `src/lib/imageSrc.ts`. All three relative forms (`./x`, `../x`, bare `images/x.png`) resolve through `resolveToAbsoluteImagePath` against baseDir; bare relative paths once failed to resolve and caused 404s (fixed 2026-08-04, with an equivalent fix in preview `preprocessImages`).
- **Correct isTauri() implementation**: Tauri v2 always injects `window.__TAURI_INTERNALS__` at runtime (invoke depends on it), while `__TAURI__` exists only with `withGlobalTauri: true` (not enabled here). Tauri detection must check `__TAURI_INTERNALS__`—checking `__TAURI__` previously meant convertFileSrc paths never took effect in production (preview's base64 fallback hid the problem).
  - **Task lists**: `taskListItemView.ts` pure-DOM nodeview supplies the clickable checkbox missing from the GFM preset.
  - **Math**: remark-math + `math_inline`/`math_block` atom schema + `mathView.ts` click editing; see “Math Formulas (KaTeX)” above.
- **Formatting**: `applyWysiwygFormat` in `wysiwygFormat.ts` covers all FormatType (toggles use preset commands; link without selection inserts and selects a placeholder; tasklist has three states); `insertWysiwygSnippet` parses Markdown fragments into PM nodes rather than degrading to plain text.
- **Default mode**: new installations default to WYSIWYG (P0's forced migration was deleted; persist respects the user's last choice). Source-dependent E2E specs use `presetSourceMode(page)` from `e2e/sourceMode.ts` to preset localStorage.
- **Bundle**: Milkdown increased the main bundle to about 2.5MB (gzip 814KB); WysiwygEditor could later use dynamic import.

### Known Limitations (P3+ Candidates)

- Table creation uses Milkdown's `|CxR| ` syntax, not Typora's `|a|b|`+Enter; no row/column add/remove UI
- Existing admonition type/title attrs cannot be edited in WYSIWYG (switch to Source to edit fence lines)
- Slash menu / floating format toolbar not connected; WYSIWYG find/replace not connected (Find only in Source/Split)

---

## 2026-08-05 WYSIWYG Editing Completion (Code Highlighting / Language Input / Admonition Creation / Shortcuts)

### Code-Block Syntax Highlighting (codeHighlightPlugin.ts)

- Approach: highlight.js (existing dependency, same engine as preview parser.ts) tokenizes → PM inline decorations, with spans using global `.hljs-*` classes (bare light/dark selectors in globals.css apply directly without new styles).
- Write `hljs.highlight(...).value` HTML into a detached div and recursively flatten it into `{from, to, cls}` ranges (nested-span class stacks merge); offsets are based on code-block content start `pos + 1`.
- Cache `Map<lang+code, spans>` (200-entry FIFO): decorations rebuild fully on each docChanged, but only changed blocks retokenize.
- Only explicit `language` is recognized (no language/unknown language/plantuml skipped); no highlightAuto—avoids misclassification flicker and per-keystroke cost, matching Typora.

### Code-Block Language Input (plantUmlCodeBlockView.ts Extension)

- Non-plantuml `pre` gains the `hljs` class (base colors/monospace rules match preview), and `<input class="code-block-lang">` is appended inside `pre` (a sibling outside contentDOM, unmanaged by PM).
- Submit: Enter/blur → `setNodeMarkup(getPos(), …, {language})`; Escape restores; unchanged values do not dispatch (avoid empty transactions dirtying the document).
- Nodeview trio: `stopEvent` intercepts input events (keys do not reach PM), `ignoreMutation` is naturally covered by “ignore everything outside contentDOM,” and `update()` synchronizes input.value while unfocused (undo/external changes).
- Entering `plantuml` follows the existing “update returns false to rebuild nodeview” path, automatically switching to dual-pane preview.

### Creating Admonitions Inside the Editor

- Flow: InsertMenu “Admonition” → `AdmonitionDialog` (nine-type grid reuses `.admonition` CSS for mini previews + optional custom title) → dispatch `editor-insert` with snippet `::: {type}{ title}\n\n:::\n`.
- WYSIWYG `insertWysiwygSnippet` naturally parses this into an admonition node through the remark transform; cursor correction expanded from table/code_block to admonition (lands in the container's first block). Source mode inserts text directly through CM with no changes.

### WYSIWYG Shortcuts (wysiwygShortcutPlugin in wysiwygFormat.ts)

- `$prose((ctx) => keymap({...}))`: Mod-K link, Mod-1/2/3 headings 1/2/3; handlers reuse the toolbar's `applyLink`/`applyHeading` (identical behavior).
- Milkdown commonmark's built-in keymap supplies Mod-B/I; native-menu accelerators do not occupy these keys (view switching is Cmd+Alt+1–4), so desktop/browser both reach the webview directly.

### Chinese IME Composition Issue Series (Final Form, 2026-08-06)

This series (`\` garbage lines, joined lines, phantom blank lines, `<!-- -->` comment wrapping) all occurred in the WKWebView + macOS Pinyin composition path and interacted with one another. It was ultimately separated into six independent mechanisms:

**1. Phantom nodes (`\`/space garbage) — strictBrParserPlugin.ts (ignore semantics)**

- Mechanism: during composition, the browser inserts attribute-free `<br>` placeholders into DOM (at syllable boundaries in preedit text and at block ends). PM's default read rules parse them into hardbreak nodes (serialized as `\`) or space text.
- Fix: custom `domParser` view prop (both readDOMChange and clipboard parsing hit `someProp("domParser")`): `br[data-type="hardbreak"]` → hardbreak node (PM-rendered hardbreak always carries this attribute, preserving round trips, with `data-is-inline` preserved through getAttrs); bare `<br>` → `ignore: true`, skipping it entirely (**producing no node or text**).
- Lesson: v1 used `getAttrs: false` to reject bare br—it fell into leafFallback as `\n` text, collapsed into spaces, and those spaces entered the text stream and disturbed PM diff alignment, causing committed-text misplacement (the “joining” regression). **To make a phantom disappear, it must produce nothing**.
- Note: the PM Plugin constructor's bindProps reads prop values immediately (lazy getter evaluation is not viable); the `$prose` factory runs after SchemaReady, so `ctx.get(schemaCtx)` is directly available.

**2. Residual fallback — hardbreakCleanupPlugin.ts (deferred cleanup)**

- Rules: ① delete pure-hardbreak paragraphs (when it is the only child, replace with an empty paragraph to satisfy `block+`); ② delete runs of ≥2 consecutive non-inline hardbreaks inside text paragraphs (legitimate Shift+Enter produces only one); ③ delete ≥3 consecutive ASCII spaces inside text blocks (residual syllable-separating spaces from macOS Pinyin preedit spans; ≤2 retained, code blocks untouched).
- Timing: composition-meta transactions only; **when a commit transaction dispatches, PM is still composing** (compositionend arrives later), so it cannot dispatch immediately—set a flag and clean once 50ms after compositionend (later than PM's scheduleComposeEnd 20ms flush; defer again if a new composition has started).

**3. Enter swallowed/lines joined — imeEnterGuardPlugin.ts**

- Mechanism: prosemirror-view's `inOrNearComposition` kludge—under its `safari` check (navigator.vendor contains Apple, which WKWebView matches), **the first non-composition keydown within 500ms after compositionend is ignored entirely** (intended to swallow Safari's paired Enter sent when IME confirms text). For Chinese users, “select candidate to commit → immediately press Enter” loses Enter → no new paragraph → subsequent text joins the previous line (“joining”). The plugin's handleKeyDown cannot see this key (PM returns early), so compensation must occur at the DOM event layer.
- Fix: listen on view.dom in the **capture phase** (before PM bubble handlers, independent of registration order); directly read/write PM's `input.compositionEndedAt` (no mirrored state, naturally synchronized with the kludge); on Enter inside the window, preventDefault + stopImmediatePropagation + manually execute the same `wysiwygEnterCommand` as normal Enter—**exactly one paragraph split**. 60ms lower bound: the confirmation's paired Enter arrives at the same time as compositionend and is allowed through to the kludge. No compensation inside code blocks.
- Testing note: jsdom's default vendor is "Apple Computer, Inc.", and PM's safari flag freezes at module load—the kludge genuinely runs in tests; compensation transactions carry `imeEnterGuardCompensation` meta so probes can count them.

**4. `<!-- -->` comment wrapping — not a serialization bug, but a CodeMirror key conflict**

- Mechanism: `@codemirror/commands` defaultKeymap binds **Mod-/ to toggleComment** (`<!-- -->` is Markdown comment syntax). In Source mode, Cmd+/ intended to switch views also makes CM comment the current line/selection; pressing again toggles it off. Wrapped admonition fences and code-block closing fences were both caused by this.
- Diagnostic technique worth recording: after all serialization paths showed no producer, wrapping `store.setContent` with call-stack logging directly identified the writer.
- Fix: filter `Mod-/` out of defaultKeymap when assembling CodeMirrorEditor (mode switching uses a window-level listener; CM does not stop propagation, so both receive the key).

**5. Single-Enter line-break model — wysiwygEnterCommand in wysiwygFormat.ts**

- User convention: in ordinary paragraphs, Enter = inline soft break (isInline:true hardbreak, serialized as a single newline with no blank line); pressing at the end of a paragraph that already ends in a break collapses to a new paragraph (Enter×2 = new paragraph, the paragraph-semantic entry). Lists use splitListItemCommand (**stock prosemirror splitListItem is incompatible with Milkdown's custom list attrs and throws TransformError**); code blocks/tables use defaults.
- Pitfall: Milkdown's `hardbreakClearMarkPlugin` resets node attrs to defaults after transactions carrying `hardbreak` meta (isInline becomes false)—insertion transactions **must not carry hardbreak meta**.
- Rendering: isInline soft breaks default to a span with a space (no actual break, so multiple lines collapse together)—the `hardbreakView.ts` nodeview consistently renders `<br>` (attributes retained for parser readback).
- Priority: wysiwygEnterPlugin is first in the wysiwygPlugins array (keymap matches first).

**6. macOS smart replacement (quotes become full-width)**

- WKWebView contenteditable enables system smart replacement by default (smart quotes/auto-capitalization), silently rewriting document bytes. The WYSIWYG root sets `autocorrect=off autocapitalize=off` (setAttribute after WysiwygEditor creation); code-block pre additionally sets `spellcheck=false`. CM6 disables all of these by default (built-in contentAttrs).
- **Existing damaged files**: cleanup prevents only new damage; `\`/`<!-- -->` remnants already in files need one manual deletion in Source mode.
- **Known related residual**: PM's kludge swallows the “first keydown” regardless of key—the first Backspace within 500ms after committing is also swallowed (the second works). Impact is minor and currently unaddressed.

### Inline HTML `<br>` Line-Break Rendering (htmlView.ts, 2026-09-09)

- **Symptom**: GFM table cells commonly use `<br>` for line breaks (rendered as breaks by GitHub/Typora), but WYSIWYG displayed the literal characters. Preview markdown-it `html: true` already rendered them correctly.
- **Mechanism**: Milkdown's commonmark preset includes an inline html atom (`htmlSchema`), whose default toDOM puts source into a span's textContent—literal display is preset behavior, not missing parsing.
- **Fix**: `htmlView.ts` $view—attrs.value matching `/^<br\s*\/?\s*>$/i` (`<br>`/`<br/>`/`<br />`/any case) renders as a real `<br data-type="html" data-value=original>`; other inline html (`<b>`, etc.) remains a literal span. Serialization always uses original attrs.value (html nodes toMarkdown output unchanged), preserving round trips; when br/span forms switch, `update()` returns false so PM rebuilds.
- **Readback support**: `strictBrParserPlugin` adds `br[data-type="html"]` → html node rule (priority 70, value read from data-value)—otherwise DOM reparsing (readDOMChange/clipboard) hits bare br's `ignore: true` rule and drops the node.
- Tests live in the “inline html nodes” group in `wysiwygRoundtrip.test.ts`: table-cell round trips, three `<br>` variant renderings and source fidelity, literal display of other inline html, and second-pass fixed point.

### Admonition Closing-Fence Fusion (`<br />\n:::` Swallowed by an HTML Block)

- **Mechanism**: when an admonition's last block is an empty paragraph, Milkdown's paragraph serializer encodes it as html node `<br />` immediately followed by the closing fence (`<br />\n:::`). On reparse, micromark treats `<br />` as the start of an html block, **and an html block continues until a blank line**—the closing fence is swallowed into the html node (`value: "<br />\n:::"`), so remarkPreserveEmptyLinePlugin's exact-match removal also fails and the whole admonition degrades to ordinary text. Related risk: when the last block is a blockquote, lazy continuation can swallow `:::`.
- **Fix** (`admonitionToMarkdown`): ① drop trailing empty paragraphs before serialization (blank lines have no Markdown semantics); ② force a blank line before the closing fence (`\n\n:::` becomes canonical, and old syntax normalizes once after parsing). The fixed point for an empty admonition is `::: note\n:::`. Regression tests lock three forms (trailing empty paragraph/empty container/trailing blockquote).

### explodeParagraph Newline Fidelity

- When reassembling merged paragraphs, insert the **original break nodes** between paragraphs instead of creating new `isInline:true` soft breaks—previously hard breaks (`\`) passing through admonition parsing were rewritten as soft breaks, silently modifying content with hard breaks on every round trip.

## 2026-08-04 Custom Dialog System

Native `confirm()`/`alert()` are unreliable in Tauri WKWebView (user report: clicking Cancel in the new-file confirmation still cleared content; the same logic worked in Chrome). All have been replaced with custom dialogs:

- `src/stores/dialogStore.ts`: Promise-based `ask(kind, message)` suspension + `answer(value)`
- `src/lib/dialog.ts`: `confirmDialog(message): Promise<boolean>` / `alertDialog(message): Promise<void>`
- `src/components/Dialog.tsx`: global singleton dialog (mounted by App), styled like TableDialog; Esc/overlay cancels and Enter confirms
- All six call sites (Toolbar/useKeyboardShortcuts/Sidebar/FileTree/useFileDragDrop) now use `await confirmDialog(...)`; no native confirm/alert remains in production code

---

## 2026-08-05 Logo Redesign (V + Caret)

New logo: purple gradient (#6366F1→#8B5CF6→#D946EF) + white V + amber caret underline. Vector source is `src-tauri/icons/icon.svg`; comparison concepts and masters are in `docs/images/logo-concepts/`.

**macOS icon safe area**: since Big Sur, icon content should occupy only ~80% of the canvas (824 within 1024); full-bleed icons look a size larger than other Dock apps. When regenerating icons, use the master with 80% padding (`docs/images/logo-concepts/a-vivid-v-padded-1024.png`) and run `pnpm tauri icon <master>`.

---

## 2026-08-05 P4 Sidebar/Toolbar Improvements and Related P3 Items (Theme/Menus/Titlebar/File Tree)

### Root Cause of dark Variant Failure and @custom-variant Fix

- **Root cause**: Tailwind CSS 4's `dark:` variant defaults to a `prefers-color-scheme` media query, so manually toggling the application's `.dark` class had no effect on `dark:` styles—dark mode appeared “half broken.”
- **Fix**: declare `@custom-variant dark (&:where(.dark, .dark *))` at the top of `globals.css`, redefining `dark:` to follow `.dark`; App.tsx's effect attaches `.dark` to `documentElement` (previously attached to the root div, where Portal/overlay components could not inherit dark mode).
- **Variable consolidation**: added `--hover-bg` / `--active-bg` / `--color-text-muted` (defined under both :root and .dark), replacing all hardcoded Tailwind grays in Sidebar/FileTree/Toolbar/App. **Convention: new components must not hardcode Tailwind grays; all colors use CSS variables.**

### Persist v0 → v1 Migration Notes

- Persisted `themeMode: 'light'|'dark'|'system'` (default system) replaces persisted `isDarkMode` bool; `isDarkMode` becomes a derived non-persisted field (`resolveTheme(themeMode, getSystemDark())`, see `src/lib/theme.ts`).
- `version: 1` + `migrate`: old persisted `isDarkMode: true/false` maps to `themeMode: 'dark'/'light'`.
- Custom `merge`: during rehydration, recompute `isDarkMode` from persisted themeMode + current system preference instead of reusing the snapshot's old value.
- System-theme changes write back through `setSystemDark`, following live when `themeMode: 'system'`; `toggleDarkMode` now means explicit light↔dark switching.

### Menu Primitives (src/components/Menu/)

- `Dropdown`: trigger + panel, outside-click/Escape close, `align: left|right`; `ContextMenu`: controlled component, fixed coordinates + boundary flipping, props `{x, y, items, onSelect, onClose}`; `MenuPanel`: consistently renders items (`{id,label,icon?,shortcut?,checked?,disabled?} | {divider:true}`); `resolveContextMenuPosition` in `menuPosition.ts` is a pure, unit-testable function.
- **Pitfall**: ContextMenu `onClose` must be stabilized with `useCallback`, or parent rerenders unexpectedly close the menu.
- MoreMenu was refactored to reuse Dropdown; **do not copy the outside-click pattern for another custom menu**. (FormatMenu / HeadingDropdown / InsertMenu were deleted during toolbar simplification and merged into MenuBar / MoreMenu—only MoreMenu.tsx remains under Toolbar.)

### Integrated macOS Titlebar Notes

- `tauri.conf.json` window config `"titleBarStyle": "Overlay", "hiddenTitle": true` (macOS only; ignored on Windows/Linux).
- With `hiddenTitle`, the system no longer draws a title, so Toolbar renders a custom centered filename (including dirty marker ●); `hidden min-[760px]:block` yields to controls in narrow windows. Render only on macOS + Tauri runtime (`isMacOSDesktop` in `src/lib/platform.ts`; App also adds `is-macos` to documentElement).
- Dragging and traffic lights: Toolbar root has `data-tauri-drag-region`; macOS left side uses `pl-[78px]` to reserve traffic-light space.

### File-Tree Collect/Apply Refresh Strategy

- File-management operations (create/rename/delete) require a new `read_directory`, but rebuilding loses expansion state. Solution: `collectExpandedPaths()` before an operation collects expanded-directory paths, and `applyExpandedPaths()` after refresh restores them by path; the current file's parent chain is forcibly expanded.
- Filter search: non-empty query uses `filterTreeByQuery` (retains ancestor chains) and temporarily expands all; clearing returns to “first level + current-file parent chain expanded” (`expandFirstLevel`).
- Renaming the currently open file must synchronize store `filePath`/`fileName` and call `renameRecentFile`, or auto-save writes to the old path.

## 2026-08-06 Editor Context Menus (Source / Preview / WYSIWYG)

After the file tree, context menus expanded to all three editor areas. Layers: menu construction is pure, actions dispatch by id prefix, and each area retains only a thin “open menu → render → dispatch” shell.

### Layered Structure

- **`src/lib/contextMenu.ts` (pure, unit-testable)**: `buildSourceMenuItems` / `buildWysiwygMenuItems` / `buildPreviewMenuItems` output `MenuItem[]` (id, i18n labels, `disabled`, dividers, shortcut labels); `getShortcutLabels(isMac)` produces ⌘/Ctrl+ label sets (display only—desktop accelerator keys are handled by native menus/OS). The WYSIWYG builder receives a `WysiwygMenuContext` snapshot (inTable/inTableHeader/linkHref/onImage/inCodeBlock), puts contextual groups first, and deduplicates trailing dividers.
- **`src/hooks/useContextMenu.ts`**: controlled state (coordinates + context snapshot data at open time), `openMenu` performs preventDefault/stopPropagation, and `closeMenu` is useCallback-stabilized (the long-standing Menu-primitive convention).
- **Action dispatch (inside each editor component)**: `format:*` → existing editor-format channel (CM `runFormat` / `applyWysiwygFormat`, matching toolbar behavior); `undo/redo` → respective histories; clipboard → `src/lib/clipboard.ts`.

### Clipboard (src/lib/clipboard.ts + New Dependency)

- WKWebView desktop does not support `navigator.clipboard.readText`, so it requires **`@tauri-apps/plugin-clipboard-manager`** (npm 2.3.2 + Cargo `tauri-plugin-clipboard-manager = "2"` + registration in `lib.rs` + explicit capabilities); browser dev/E2E falls back to `navigator.clipboard`. Failures return null/false and log, so callers need no try/catch.
- **⚠️ Permission pitfall (real-device diagnosis, 2026-08-24)**: plugin 2.3.2's `default.toml` permission set is **empty** ("Clipboard interaction needs to be explicitly enabled")—writing `clipboard-manager:default` in capabilities grants nothing, and ACL silently denies all reads/writes (frontend catch → warn → null/false with no visible UI), appearing as “context-menu copy/cut/paste all do nothing.” Explicitly write `clipboard-manager:allow-read-text` + `clipboard-manager:allow-write-text`. Browser-dev navigator.clipboard fallback works, so this appears only in packaged/dev Tauri apps.
- WYSIWYG copy/cut serializes as **plain text** (`doc.textBetween`)—format-preserving clipboard serialization is not connected and remains a known limitation; paste reads the clipboard and parses it as Markdown (matching native Milkdown paste through `insertWysiwygSnippet`), falling back to plain text for invalid input.

### WYSIWYG Context (wysiwygContextMenu.ts)

- **Cursor first**: contextmenu uses `posAtCoords` to translate the click; outside the selection, first move the `TextSelection.near` cursor there (standard editor behavior), then resolve context and actions against the new cursor.
- **Links**: `getLinkRange` hits when the cursor is inside a text node carrying the link mark (including the right boundary), then expands across same-mark nodes on both sides—custom rather than tiptap's `getMarkRange`, because the latter misses nodes at the `parentOffset=0` boundary.
- **Tables**: row/column **insertion** reuses milkdown gfm commands (`addRowBeforeCommand`, etc., acting on the current selection); row/column/whole-table **deletion** uses custom PM transactions (row index from `$from.index(tableDepth)`, collect cell deletion ranges per row, then delete back-to-front)—not milkdown's `selectRowCommand` + `deleteSelectedCellsCommand` index-semantic combination. Schema note: the header is a distinct `table_header_row` node, and Markdown tables require a header → header-row deletion is forbidden (disabled menu + action-layer guard); deleting the last remaining column degrades to deleting the whole table.
- **Images**: atom nodes have no internal cursor; context click uses `nodeBefore/nodeAfter` for hit detection and deletion.
- **E2E pitfall**: Preview's `.markdown-body` selector also matches the mounted-but-hidden `.markdown-body.wysiwyg-editor`; tests must distinguish `.markdown-body.p-8`.

### Typora-Style Context-Menu Reorganization and Paragraph Insertion (2026-08-07 Update)

- **MenuPanel submenus**: `MenuSubmenuItem { children: MenuItem[] }` (one nesting level). The submenu panel lives inside the trigger row's relative container (`left-full -ml-1` slight overlap, so hover transition has no gap); on open, the trigger row's `getBoundingClientRect` corrects position: flip left (`right-full`) if the right edge lacks space and shift upward at bottom overflow. Hovering ordinary items/dividers closes an open submenu; clicking a submenu trigger only opens it and does not dispatch an id.
- **Menu structure aligned with Typora**: Source = base group + Paragraph▸ (format:h1-h3/quote/list/tasklist/codeblock, all reusing existing formatTransaction) + Format▸; WYSIWYG = context group + base group + Paragraph▸ (adds Body Text `block:paragraph` = setBlockType paragraph) + Format▸ + Insert▸ (image/table/code block/horizontal rule + insert paragraph above/below).
- **insert:\* actions**: `insertWysiwygSnippet` parses and inserts Markdown (table snippet reuses `generateTable(2,2)`); note that Milkdown serializes horizontal rules as `***`.
- **Insert paragraph above/below**: `$from.before(1)` / `$from.after(1)` locate the current **top-level block** boundary, insert an empty paragraph, and place the cursor with `TextSelection.near(pos+1)`—solving the inability to insert a paragraph when tables/code blocks touch document edges or one another.

### Empty Paragraphs Serialized as `<br />` (2026-08-07)

- **Symptom**: empty paragraphs remaining between WYSIWYG block elements (code blocks/tables) serialized as standalone `<br />` lines, polluting source.
- **Root cause**: Milkdown's commonmark preset includes `remark-preserve-empty-line`—the paragraph serializer outputs a `<br />` html node for an empty paragraph (when not the document's last node; see `shouldPreserveEmptyLine(ctx)` in preset-commonmark `paragraphSchema.toMarkdown`); the parser's `visitEmptyLine` removes standalone `<br />` lines from mdast. This is Milkdown's “lossless blank lines” design but appears as garbage lines to users.
- **Fix**: `wysiwygPlugins.ts` removes that plugin from the commonmark preset by tuple reference identity (`commonmark.filter(p => !preserveEmptyLineParts.has(p))`). Afterward: empty paragraphs serialize as ordinary blank lines (Markdown rendering collapses them anyway, and reload removes them naturally); existing source `<br />` lines parse as preserved html nodes; empty table cells serialize as `|  |` (valid GFM).
- **Note**: `$remark` returns a `[pluginCtx, plugin]` tuple, and commonmark stores these as two independent entries; filtering must remove both.

### WebKit Context-Click Selection Theft (2026-08-07, Probe Diagnosis)

- **Symptom**: right-clicking at the start of a WYSIWYG/Source line selected the adjacent first word, and right-clicking a blank line selected the whole line (menu actions then acted on the wrong selection).
- **Probe findings** (`save_file` wrote /tmp logs with event-level timing): WebKit/WKWebView writes word/line selection into DOM between right-button `mousedown`→`contextmenu`—**an uncancellable internal step** (preventDefault on `mousedown`/`contextmenu` has no effect). Editor-kernel (PM/CM) state is not yet polluted at that moment, but a subsequent `selectionchange` adopts the DOM selection and makes the pollution permanent.
- **Fix (override rather than intercept)**: on `contextmenu`, compute the click position through `posAtCoords` → if outside the selection, dispatch a collapsed selection there → **then directly `window.getSelection().collapse(view.domAtPos(head))` to force DOM selection back to the caret**. The kernel subsequently synchronizes to that caret. Ineffective mousedown snapshots/preventDefault were removed.
- **Note**: when `TextSelection.near` cannot find a text position it falls back to NodeSelection; `domAtPos` can throw at extreme positions (try/catch and ignore; kernel selection remains correct).

### Context-Click Selection Hardening and Clipboard Permission Fix (2026-08-24, Real-Device Diagnosis)

- **Clipboard permission root cause**: see “⚠️ Permission pitfall” above—this, not selection, was the main cause of the user report that “WYSIWYG context-menu copy does nothing.”
- **Selection hardening (symmetric WysiwygEditor / CodeMirrorEditor implementations)**: WKWebView context-click gestures **do not dispatch mousedown** (macOS WebKit convention), and selection theft may occur before any JS event, so kernel selection may already be polluted by contextmenu. Two layers:
  1. **Candidate-selection restoration**: continuous `selectionchange` tracking maintains cur/prev double-buffered selection history (validated against doc identity and invalidated on any document change); on contextmenu, select the first candidate from “mousedown snapshot (works in Chromium) → current selection → selection history” that **strictly contains** the click (`from <= pos < to`, excluding polluted selections whose head has been collapsed to the right-click point), restoring through dispatch + `setBaseAndExtent` DOM write.
  2. **Selection guard while menu is open**: store the opening anchor in a ref; every `selectionchange` while open locks DOM/kernel selection back to that anchor (covering late selection theft and DOM collapse caused by menu-item clicks); any `mousedown` (menu item/outside to close) disables it—the kernel already ignores DOM selection outside the editor, and menu actions read kernel state unaffected.
- **Preview area**: copy now uses `selectedText` snapshotted when the menu opens (new `PreviewMenuContext` field), no longer depending on live DOM selection at click time.
- **Known boundary**: if selection theft takes the form of a “word selection” (rather than head truncation/collapse), the polluted word selection can be selected as a candidate (same as old behavior, not a regression).

### Window-Level Double Scrollbars (2026-08-24, Real-Device Diagnosis)

- **Symptom**: an almost full-height window-level scrollbar appeared beside the editor scrollbar (most visible in WYSIWYG).
- **Root cause**: status bar `h-6` (24px) minus its 1px top border leaves a 23px content box, while the view-mode `Dropdown` trigger's `p-1.5` + text-xs line height reaches 28px—vertical centering overflows 2.5px downward and expands the document beyond the viewport (`scrollHeight` ~3px taller), producing window-level scrolling.
- **Fix**: supplied `Dropdown` `triggerClassName` **replaces** default `p-1.5` (avoiding dependence on Tailwind conflicting-class cascade order), and the status bar passes `px-1.5 py-0.5`; App root adds `overflow-hidden` as a fallback so no chrome-area overflow can produce a window scrollbar.

## 2026-08-07 P5: Menu Completion / Dock Menu / File Associations / Drag Fixes

### Root Causes of an Undraggable Titlebar (Two)

1. **ACL permission missing**: in Tauri 2.10's window-plugin permission table, `start_dragging` is **not** in the `core:default` set (`("start_dragging", false)` in build.rs PLUGINS; `internal_toggle_maximize` is `true`—explaining “double-click maximizes but hold-and-drag does nothing”). Tauri-injected `drag.js` calling `plugin:window|start_dragging` is silently denied by ACL. Fix: explicitly add `"core:window:allow-start-dragging"` to `capabilities/default.json`.
2. **drag.js does not walk ancestors**: `e.target.getAttribute('data-tauri-drag-region')` checks only the target itself (no `closest()`). The Toolbar root had the attribute but was largely covered by children (button groups/dividers), so hitting a child did not drag. Fix: left/right group containers also carry `data-tauri-drag-region` (buttons/SVGs lack the attribute, so clicks are unaffected).

### Paragraph/Format Menu and Shortcut Routing

- Menu IDs share the context-menu convention: `format:<FormatType>` → `editor-format` event bus; `insert:image` uses `editorActions.insertImageFromPicker`; `insert:table|admonition` → `app-open-dialog` (Toolbar mounts dialogs); `insert:hr` → `editor-insert`.
- **⌘B/I/K/1-6/⌘0 on desktop are menu-event-driven** (the OS intercepts accelerators, so the webview receives no keydown); browser dev/E2E has no native menu, so CM keymap / Milkdown keymap / useKeyboardShortcuts remain—the same “non-overlapping” model as ⌘O/S/N.
- ⌘0 yields to Paragraph → Body Text (strip block prefix); Actual Size moved to ⇧⌘0 (MoreMenu label updated; both combinations handled by browser-side Editor.tsx).
- `FormatType` expanded to h4-h6/ol/paragraph: CM `matchBlockPrefix` consistently recognizes headings/`> `/`- [ ] `/`- `/`\d+. ` prefixes (fixing the old quirk where formatting a task item left `[ ] `; ol toggles using actual numbering); paragraph uses a dedicated strip-prefix path (early branch in `formatTransaction`, not isBlockFormat). Milkdown `applyParagraph`: list_item→liftListItem, blockquote→lift, others→setBlockType(paragraph).

### Menu Event Flow and State Synchronization

- Complete chain: `src-tauri/src/menu.rs` builds the system menu (macOS App/File/Edit/Paragraph/Format/View/Window; adapted Windows/Linux) → `on_menu_event` emits `native-menu-event` through `emit_to_focused` → frontend `src/lib/nativeMenu.ts` listens only to its own window through `getCurrentWindow().listen`, then `handleMenuAction` dispatches. **Do not use global `listen`**: it receives menu events targeted to other windows, causing multiple windows to save/export PDF simultaneously.
- `Menu::get` checks only top-level items; submenu items must be found recursively through lib.rs `find_menu_item`.
- muda CheckMenuItem clicks natively toggle checks; the authoritative final state comes from frontend sync (`set_menu_item_checked`/`set_menu_item_enabled`).
- After a menu rebuild, all check/enabled values return to construction defaults and must be fully resynchronized.
- Edit Undo/Redo use custom items (system-level undo would bypass CM/Milkdown history).
- `editor-find`: native Find → frontend → `@codemirror/search` find/replace panel.

### macOS Dock Context Menu (objc2)

- Tauri 2.10 / muda 0.17 / tao 0.34 have no Dock-menu API (only `set_dock_visibility`). Implementation: during setup, get `NSApplication.sharedApplication().delegate()` (tao's AppDelegate instance) → `class_addMethod(applicationDockMenu:, "@@:@")` injects an IMP returning a globally cached `NSMenu` (`Mutex<Option<Retained<NSMenu>>>`, unsafe Send/Sync wrapper, all access on main thread).
- Menu-item target is `VividMarkDockMenuTarget`, an NSObject subclass defined with `define_class!` (newDocument:/openDocument:/openRecent:/clearRecent:); clicks emit `native-menu-event` and **reuse all frontend dispatch**. Recent-file paths use `NSMenuItem.tag` to index a global path table rather than representedObject (avoiding downcast).
- Item actions reuse the `native-menu-event` channel with IDs `file-new` / `file-open` / `open-recent:*` / `clear-recent` (also targeted to the focused window through `emit_to_focused`).
- Defensive behavior: `class_respondsToSelector` checks first; if a future tao provides the method, injection skips it instead of overriding. **Tao/Tauri upgrades require regression verification here**.
- Rebuild: frontend `rebuildMenu` calls `update_dock_menu` at the same subscription point (non-macOS registers a no-op stub command); dependency versions align with tao 0.34 (objc2 0.6 / objc2-app-kit 0.3 / objc2-foundation 0.3) to avoid duplicate major versions.

### File Associations (Open With)

- `tauri.conf.json` `bundle.fileAssociations` (md/markdown/mdown/mkd, role=Editor) → packaging generates macOS `CFBundleDocumentTypes` (appears in Open With, not default handler), Windows registry entries, and Linux mime. **Works only for a packaged, installed .app** (LaunchServices registers on installation/first launch); `pnpm tauri:dev` cannot verify it.
- Runtime: macOS double-click/Open With → `RunEvent::Opened { urls }` (received by the same running instance without starting another process) → `route_open_paths` window routing (focus/reuse/create; cold start queues in main's startup-open queue) → frontend `src/lib/openWith.ts`; `take_startup_open_files` drains startup backlog by window label. Windows/Linux start a new process with argv (no Opened event): setup `collect_argv_files()` parses argv (skipping `-` switches and nonexistent paths) → same `route_open_paths` (cold start always hits “main not ready → startup queue,” never creates a window—Windows main-thread creation self-deadlocks; see window_router). **Single-instance is not implemented**: double-clicking a file while the app runs starts a second process (independent window registries; functional, but no cross-process “already open → focus”), a future item.
- **Platform-gating pitfall (v0.2.3 CI)**: the `RunEvent::Opened` variant itself is `#[cfg(any(target_os = "macos", target_os = "ios"))]`, so Windows/Linux compilation directly fails with E0599—local macOS packaging cannot detect this. Both the event branch and `handle_opened_urls` need `#[cfg(target_os = "macos")]` (closure params become `_app/_event` to avoid unused warnings on other platforms). Check registry-source cfg conditions before adding platform-specific APIs.
- **Cold-start Opened arrives extremely early (fixed 2026-09-15)**: on macOS cold-start Open With, `RunEvent::Opened` may arrive **before log-plugin registration, config main-window creation, and frontend reporting** (marker-file evidence: handler ran but all logs were lost). Old branch 2 required `get_webview_window("main").is_some()`; at that point it was None → fell directly into create-window → file opened into doc-1, config main was subsequently created as usual → an extra welcome window every time. Fix: new `APP_READY` (set at `RunEvent::Ready`); **before Ready, queue paths in main's startup queue even when main does not yet exist** (it will be created shortly, and the ready frontend drains by label); only after Ready does missing main mean “closed” and require creation. Branch 3 reuse candidates also gained fallbacks: source → LAST_FOCUSED → (file associations only) main → other clean empty windows (LAST_FOCUSED is empty before a Focused event arrives).
- **`take_startup_open_files` must receive this window's label**: `label=None` means “clear every window's queue” (used only for HMR cleanup in the file-open-request hot path). openWith.ts once omitted the label—any window starting could steal files queued for other windows (under cold-start races, main stole doc-1's queue, leaving doc-1 with only the welcome page).
- **tauri-plugin-log `Builder::default()` includes `Stdout + LogDir` targets**: explicitly adding `.target(LogDir)` writes the same log file twice (duplicate lines and KeepOne rotation runs twice). For customization, call only `.level()/.level_for()`; do not append another target.

### Additional Fixes (2026-08-07): Context Click Triggering Resize / Confusing View Menu Item

- **Context click triggered sidebar resize**: `useResizable.handleMouseDown` did not check `e.button`, so right button (button=2) also entered resize state (contextmenu and mousedown share a sequence)—right-clicking the sidebar's 4px right-edge hit area opened the menu and started resizing simultaneously. Fix: respond only to `e.button === 0`. Related issue: divider `title` hardcoded English → moved to i18n (`sidebar.dragToResize`).
- **Removed View menu “Source Code Mode”**: placing the ⌘/ toggle beside four view-mode check items (WYSIWYG/Source/Split/Preview) was ambiguous. Typora has only two states and avoids this; VividMark's explicit four-mode group is the authoritative entry. After removing the item, ⌘/ has no desktop accelerator and keydown reaches the webview for `useKeyboardShortcuts` (same behavior as before the change).
- **Excess WYSIWYG table-row height**: Milkdown wraps table-cell content in `<p>`, and `.markdown-body p`'s 1em bottom margin contributed to row height (58px vs preview 47px). Fix: `th/td > p { margin: 0 }` (preview has no p wrapper and is unaffected), resulting in 44px.

## 2026-08-13 Multi-Window (Typora-Style SDI) and Menu-Rebuild Storm Investigation

### Architecture Notes (window_router.rs / windowManager.ts)

- One window per document = independent webview/JS context, so the single-document store needs no refactor; the window registry (`WINDOW_STATES`, frontend reports filePath/isDirty through `report_window_state`) is the sole source of truth for file→window routing.
- Menu/Dock events target `LAST_FOCUSED` through `emit_to_focused` (tauri/muda menu events carry no source window; macOS menu clicks do not change key window, while Windows menu clicks focus first—the heuristic works on both).
- Open-path routing `route_open_paths`: already open→focus; clean empty window→reuse (targeted `file-open-request`); otherwise create. **Creation has pending deduplication** (skip if the path is already in a new window's startup queue)—prevents duplicate windows from repeated frontend trigger races.
- Focused window drives menu check/enabled (nativeMenu.ts focus gating + full resync in `onFocusChanged`); `rebuildMenu` deduplicates by payload (no rebuild when content is unchanged)—rebuild means the entire Rust menu tree + Dock menu + full check/enabled resync, so frequent rebuilding becomes a storm.
- `LAST_FOCUSED` is maintained by Focused/Destroyed in `on_window_event`.
- New windows use `create_document_window`: the three integrated-macOS-titlebar settings (titleBarStyle/hiddenTitle/trafficLightPosition) are copied into the builder behind cfg gates; pending deduplication before creation prevents duplicate windows.
- Capabilities require `windows: ["*"]` (window labels are dynamic).
- The PDF-export hidden-window label (`pdf-export`) is excluded from open routing.

### Pitfall 1: React StrictMode Async Cleanup Race → Listener Leak (Critical)

App.tsx's three initializers (initNativeMenu/initOpenWith/initWindowManager) originally used “async init → assign cleanup inside then.” During StrictMode's double mount, the second effect's cleanup overwrote the first, **so the first listener was never unregistered**—every event was handled twice. In the single-window era this was only idempotent waste; with multiple windows, duplicate open-recent calls → route race → **two windows for the same file**. Fix: useRef guards reentry and consolidates into one effect with no manual cleanup (listener lifetime follows the webview context and is released when the window is destroyed). **Every effect using “async registration + cleanup” has this pitfall**.

### Pitfall 2: Vite HMR/Full Reload + Ghost Startup Queue = Storm Fuel

When a window is created, its path enters `STARTUP_OPEN_FILES[label]`, and the ready frontend drains it by label through `take_startup_open_files`. If HMR reloads the page before the initial frontend drains it (or a duplicate window created by a leaked listener never initializes correctly), a “ghost entry” remains—every page reload drains it and reopens the file (lastOpened refresh → menu rebuild), creating a self-sustaining create/reopen loop. Fix: the hot path receiving `file-open-request` clears all through `take_startup_open_files { label: null }`.

### Pitfall 3: macOS WKWebView Windows Do Not Share localStorage

Measured: each window has independent localStorage (storage events do not fire across windows)—cross-window preference sync cannot use storage events and instead broadcasts Tauri events (`prefs-sync`, fields themeMode/language/recentFiles; listeners compare values before writing to prevent echoes). Diagnostic note: temporary Vite dev-server middleware (POST /\_\_diag printing the request body) can route otherwise invisible webview console information into the dev terminal.

### Storm Symptoms and Diagnosis Path

Symptoms: after opening multiple md files, the app main process + every webview sustained 30–90% CPU (Activity Monitor), and kernel_task spiked and throttled the system. Logs showed hundreds of `rebuild_menu` calls in the same millisecond for the same window. Diagnosis path: rebuild caller label (add a window parameter to the command and log its label) → frontend DIAG fetch instrumentation (found repeated openFileByPath calls and continuous lastOpened refreshes) → take_startup returning the same path in two windows (found leaked listener creating duplicate windows) → StrictMode race + ghost queue.

## 2026-08-13 Export as Website (Static Site Package)

Open folder → File menu/MoreMenu “Export as Website…” → choose output location → generate `<picked>/<folder-name>-site/` as a deployable static site (MkDocs style: top bar + collapsible left navigation + light/dark toggle). Zero external dependencies (no Python/mkdocs CLI). Frontend entry is `exportSite()` in `exportSite.ts` (choose output directory → raw `readDirectory` tree → render → Rust batch disk writes); Rust follows pdf.rs separation in `src-tauri/src/site_export.rs`.

### Key Design

- **Mirror directory structure**: `guide/intro.md` → `guide/intro.html`; non-md assets copy unchanged to their original relative locations (Rust `export_site` fs::copy)—relative image src values need **zero rewriting**. Only `.md` cross-links rewrite (to `.html`, preserving #anchor; README/index targets map to index.html). This is the design's core simplification.
- **preserveImages rendering**: preview's image rule converts local src through convertFileSrc (asset://), which is a dead link in an exported site. `parseMarkdownAsync(content, { preserveImages: true, inlinePlantUml: true })` passes through markdown-it render's env parameter to skip conversion in the image rule (no baseDir, so base64 image inlining does not trigger—that remains PDF single-file-only); `inlinePlantUml` renders UML locally into inline SVG (since 2026-08-14; previously remote plantuml.com images required network).
- **Navigation inference** (siteGenerator.ts, pure): numeric prefixes `01-`/`01_`/`01.` sort and are stripped from display; README.md/index.md become their directory's index.html and always sort first (fallback title is directory name; root without H1 injects “Home”); with no root index, a meta-refresh redirect home page is generated; asset-only directories do not enter navigation.
- **Page shell** (siteTemplate.ts): shared CSS `vividmark-site/site.css` = `collectDocumentCss()` (the app's .markdown-body/hljs/theme variables, exported from exportPdf.ts for reuse) + shell styles (reuse --editor-bg and other variables, with `:root`/`.dark` definitions automatically included in collected CSS); `inlineKatexFonts` only when formulas exist; `<html>.dark` toggle + localStorage `vividmark-site-theme` + inline head anti-flash script; directory collapsing uses `<details>/<summary>` with zero JS; `.nojekyll` supports GitHub Pages.
- **Heading IDs**: GitHub-style slugs (preserve Unicode letters/numbers, strip punctuation, spaces to hyphens, duplicate suffix -1), post-processed into h1–h6 through DOMParser so in-page and cross-page `#anchor` links work.
- **Menu wiring**: `export-site` starts disabled, and `syncMenuEnabled` synchronizes it from `openedFolder` (following file-reveal); handleMenuAction calls `exportSite()` directly (folder-level actions do not use the editor-\* bus, following file-open-folder).

### Known Limitations (Accepted in First Version)

- read_directory depth limit 10; overwrite does not clean old files (repeated exports leave HTML from deleted sources); no site search or per-page TOC; links to `.md` outside the export set also change extension (they would be broken after deployment anyway).

### Config Awareness (2026-08-14 P1, `siteConfig.ts`)

- Flavor detection priority: mkdocs > vuepress > plain. Root `mkdocs.yml` → mkdocs flavor, with `docs_dir` narrowing export scope; a parent directory's MkDocs config is accepted if its `docs_dir` points back to the opened directory; a `.vuepress` directory → vuepress flavor.
- MkDocs side navigation = original nav config (`buildNavFromMkdocsNav`): curated allowlist—unlisted pages are not automatically appended; external entries open in a new window; entries with missing files are skipped and logged.
- Title chain: nav > frontmatter > H1 > filename; frontmatter is stripped without rendering; export-success notice includes the config source.

---

## 2026-08-13 Window Cannot Close (Tauri 2.10 ACL Tightening: allow-destroy Is Non-Default)

> Affected version: 0.4.0 (macOS). Red light / Cmd+W / File menu Close Window all silently failed; yellow/green lights worked.

### Symptoms

Clicking the red light did not close the window; Cmd+W and menu Close also failed. Closing through accessibility (AX) worked. The installed 0.4.0 reproduced it too, ruling out then-uncommitted frontend changes.

### Root-Cause Chain

1. User-triggered macOS close (red light / Cmd+W / menu) goes through `performClose:` → tao `windowShouldClose:` → emits `CloseRequested` and **returns NO** (the window does not close directly; the application layer handles it).
2. Tauri sees a frontend `onCloseRequested` listener (`src/lib/windowManager.ts` dirty confirmation), intercepts default close, and sends `tauri://close-requested` to the webview.
3. After the frontend handler determines the document is clean and does not call `preventDefault`, the `@tauri-apps/api` wrapper executes `await this.destroy()` to actually destroy the window (see onCloseRequested in `node_modules/@tauri-apps/api/window.js`).
4. **Since Tauri 2.10, `core:window:allow-destroy` is no longer in the default permission set** (allow-start-dragging / allow-set-title were removed in the same batch and had already caused issues), so ACL silently denies `destroy()`'s invoke → Promise rejects unhandled → the window remains forever.

Why every other path worked, making this misleading:

- AX (System Events clicking the button) triggers a more direct close path that **bypasses `windowShouldClose:`**, avoiding the JS gate → closes.
- Yellow (minimize) / green (fullscreen) do not pass the `CloseRequested` gate → normal.
- Webview clicks and menubar opening work—only “close window” is swallowed by the gate.

### Fix

- Add `core:window:allow-destroy` to `src-tauri/capabilities/default.json` (alongside existing allow-start-dragging / allow-set-title).
- Also fixed File menu Close Window displaying English: `PredefinedMenuItem::close_window(app, None)` default text does not follow system language (the app bundle has no localized lproj), so it now explicitly receives `Labels.close_window` (Chinese “关闭窗口” / English "Close Window").

### Lessons

- **After a Tauri upgrade, compare every window method called through the frontend JS API against the default set in `tauri/permissions/*/autogenerated/reference.md`**—ACL denial is completely silent (invoke rejects with no UI feedback), indistinguishable from “click does nothing.”
- Useful diagnosis for “click does nothing”: compare AX triggering (System Events) with synthesized mouse events (CGEvent)—AX dispatches an action directly while synthesized clicks follow the complete hit chain, and their difference quickly isolates the failing layer. Synthesized clicks work on native Tauri-window buttons (yellow light can trigger) and Finder, so the method itself is reliable.
- Related behavior confirmation: destroying the **last** window through destroy() also exits the app (Tauri default; `RunEvent::ExitRequested` is not connected). This is currently accepted; for future Typora-style “close window without quitting, remain in Dock,” intercept ExitRequested + prevent_exit in the run callback.

---

## 2026-08-14 macOS Traffic Lights “Centered First, Then Jump Up” (setTitle Makes AppKit Reset Button Positions)

### Symptoms

Immediately after window creation, traffic lights were vertically centered in the 48px toolbar; about 1.8s later (perceived as “they moved up after a while”), buttons jumped back to AppKit's default higher position. AX measured button centers moving from {131,45} to {128,38} (window origin {120,30}).

### Root-Cause Chain

1. `trafficLightPosition {x:12, y:25.5}` in `tauri.conf.json` is applied by tao only **at window creation**, initially centered correctly. (Tao semantics: titlebar height = button height 14pt + y, with buttons attached to the container bottom; traffic-light vertical-centering formula y = target button-top offset + 8.5pt, so a 48px toolbar corresponds to y = 25.5.)
2. After every render, frontend `Toolbar.tsx` called `setTitle` from `@tauri-apps/api/window` to synchronize the Typora-style title (filename ●). AppKit `setTitle:` triggers titlebar layout and resets standardWindowButton to its default frame—erasing trafficLightPosition.
3. tao 0.34.5's `inset_traffic_lights` logic replays the inset only once in `drawRect`, changing only the button container's frame and not button y (measured: cannot self-heal); Tauri exposes no public API for runtime traffic-light rearrangement.

### Fix

Added `src-tauri/src/titlebar.rs`, exporting `set_window_title` to replace direct frontend setTitle:

- `with_webview` obtains NSWindow on the main thread, calls `setTitle:`, then `layout_traffic_lights` explicitly rearranges: button container (superview) height = button height 14pt + 25.5, pinned to the top; three buttons x = 12 + i×spacing and top offset 16pt (converted into container coordinates through `convertRect:toView:nil`, because the titlebar view is flipped).
- Frontend `Toolbar.tsx` now uses `invoke('set_window_title', { title })`; every later setTitle also restores centered traffic lights, providing self-healing.
- Cargo.toml's objc2-app-kit needs the `NSView` feature.

### Lessons

- **On macOS, any call that changes a native NSWindow property (title, style) can trigger AppKit titlebar relayout**; Tauri-layer configuration applies only once at creation, and later layout must be replayed in native source.
- Useful tools for window-chrome layout diagnosis: `osascript` + System Events reading `position of button N of window 1` (button 1/2/3 = red/yellow/green); polling catches timing issues such as “correct first, then jumps.”
- Similar symptoms on Windows/Linux do not use this note (traffic lights are a macOS concept; this code is entirely cfg-gated to macOS).

---

## 2026-08-14 PlantUML Local Rendering (@plantuml/core TeaVM Engine Replacing Online Service)

### Selection

- **Adopted**: official `@plantuml/core@1.2026.6` (plantuml/plantuml#2715, pure JS engine compiled with TeaVM; **only ≥1.2026.6 is MIT-licensed; earlier versions are GPL**). plantuml.js 7.15MB + viz-global.js 1.44MB (Graphviz/Viz.js, WASM already base64-inlined, zero extra fetch) + openiconic.js 51KB; emoji.js (1.88MB, `<:emoji:>` sprite) is not bundled and can be added if needed.
- **Rejected CheerpJ routes** (plantuml/plantuml.js, sakirtemel/plantuml-wasm): their licenses require Leaning Technologies' cloud runtime, so they are not truly offline.
- **Rejected plantuml.jar + JRE**: requires Java on the user's machine, conflicting with “lightweight, no external runtime.”

### Assets and Loading

- vite-plugin-static-copy copies `node_modules/@plantuml/core/{plantuml.js,viz-global.js,openiconic.js,LICENSE}` to `vendor/plantuml/` (not committed; version follows package.json); dist size 5.1MB → ~14MB.
- `src/lib/plantuml.ts` lazy-loads: the first UML diagram triggers `loadScript(viz-global.js) → loadScript(openiconic.js) → import(plantuml.js)` (the first two are classic scripts registering `window.Viz` / `window.PLANTUML_OPENICONIC` globals and must precede rendering; dynamic import uses `/* @vite-ignore */` to bypass bundle analysis).

### Engine Behavior (Local Measurements + Official Documentation)

- **Rendering within one JS context must be serial** (the engine shares internal state and concurrent calls silently overwrite one another, officially documented)—the wrapper enforces a Promise queue, plus result cache (Map, LRU cap 200) + inflight deduplication.
- The `dark` option is documented only for `render(lines, targetId, {dark})` (not renderToString) → consistently use a detached div (offscreen absolute positioning, **not display:none**, to avoid affecting internal measurements) + MutationObserver waiting for `<svg>` before reading innerHTML, rejecting after 15s.
- Syntax errors also produce an “error diagram” SVG (same as the online service), so reject occurs only for engine failures/timeouts → callers fall back to an online plantuml.com img (retaining the old display path; behavior in offline environments matches the old version and is not a regression).
- The engine needs canvas 2D to measure text: **jsdom cannot run it** (measured hanging at getContext until timeout), so unit tests inject a fake engine through `setPlantUmlEngineForTests`; real-engine smoke coverage is `e2e/plantuml.spec.ts` (Playwright intercepts outbound plantuml.com requests, proving fully offline rendering).
- Each window's webview loads an independent engine copy (memory traded for isolation, accepted).

### Pipeline Changes

- markdown-it's `highlight` callback must be synchronous → fenced and `@startuml` inline forms (parser.ts) emit only `<div class="plantuml-diagram" data-plantuml-src="encodeURIComponent(source)"><div class="plantuml-loading">` placeholders (also eliminating preprocessPlantUML's duplicated hand-built URL implementation).
- Preview (Editor.tsx): `renderPlantUmlPlaceholders(container, {dark})` progressively renders DOM (text first, SVG later); placeholder divs retain data attributes after rendering, so theme changes rerun with the new dark value (SVG colors are fixed at render time and CSS variables cannot reach inside SVG).
- Export (PDF/site): `parseMarkdownAsync` signature changed from `(content, baseDir?)` to `(content, { baseDir?, preserveImages?, inlinePlantUml? })`; with `inlinePlantUml: true`, placeholders in the HTML string are replaced with inline SVG—PDF hidden windows and exported sites now need zero network (also fixing the first-version site limitation of “requires network after deployment”).
- WYSIWYG (plantUmlCodeBlockView.ts): preview+source dual panes unchanged; preview now renders locally (500ms debounce + render sequence preventing stale overwrites + editorStore `isDarkMode` subscription for rerender; destroy unsubscribes and increments the sequence to invalidate in-flight renders).
- Bare WYSIWYG `@startuml` (inline form not wrapped in a fence) receives no special handling.

### Two Bugs Exposed by Trial Regression (Fixed Same Day)

- **Diagrams disappeared after switching view modes**: the preview container mounts only in preview/split (conditional Editor.tsx JSX), while the placeholder-render effect depended only on `[renderedHtml, isDarkMode]`—entering from WYSIWYG/Source mounts a new container with unchanged deps, so the effect does not rerun and placeholders stay loading forever. The first E2E passed only because the 120ms debounce happened to place renderedHtml after the switch. Fix: add `viewMode` to deps; regression test “wait after content is ready, then switch modes.” **Lesson: effect deps must cover the source of “container availability.”**
- **Inline regex damaged fenced/inline code**: the `@startuml...@enduml` inline replacement regex did not understand Markdown structure—PlantUML source inside fenced code blocks (markers are normal there) and `@startuml` mentions inside inline code (for example, syntax documentation) were mismatched and nested incorrectly (this existed in the online-service era too; tests never covered “marker inside fence”). Fix: before replacement, mask code regions with `FENCE_BLOCK_REGEX` (```/~~~ fences) + `INLINE_CODE_REGEX` (single-backtick single-line spans), then restore afterward (restore before encoding into placeholder data attributes); unclosed fences are not masked (rare user error, accepted).

---

## 2026-08-14 SEO and Outreach Operations Notes

Non-technical release/operations knowledge, referenced alongside the release process:

- **Search Console property URL must be the site root** (`https://scottli139.github.io/vividmark/`); entering `.../sitemap.xml/` leaves nowhere to place the HTML verification file/meta. Verification meta tokens are shared across the account, so recreating a property does not require a new token. After sitemap submission, "Couldn't fetch" is transitional and automatically becomes Success within hours to days; do not resubmit.
- **Pages-site SEO assets**: `docs/index*.html` heads (keyword title/description, OG/Twitter cards, JSON-LD SoftwareApplication, bilingual hreflang) + `docs/sitemap.xml` (including hreflang annotations) + `docs/robots.txt` + `docs/images/og-image.png` (1200×630, crop from screenshot with `sips -Z 1200` then `-c 630 1200`). **Pitfall: JSON-LD contains `softwareVersion`; synchronize these two places when bumping the three release version numbers.**
- **AlternativeTo**: newly registered accounts must be 7 days old before "Suggest new application" (anti-spam); listing review takes several days to a week; after approval, use "Suggest alternative" on Typora/Obsidian/MarkText pages. The external link is dofollow, DR≈80, and a major entry for the "typora alternative" search term.
- **awesome-markdown-editors 2026 policy**: new entries go into `UPCOMING.md` first (no longer directly into README) and must include a source link; projects without source go into `COMMERCIAL.md`.
- **Baidu indexes github.io very poorly** (its crawler mostly does not fetch it). Main Chinese-traffic channels are HelloGitHub (self-submission through GitHub issue, manual monthly selection, appearing within 1–2 issues if selected) and community posts (V2EX/Juejin/SSPai); if Baidu indexing of a Chinese site is needed, use Gitee Pages or a custom-domain mirror.

---

## 2026-08-17 VuePress Best-Effort (Site-Export Config Awareness P3, Pipeline Finalized)

Plan: `docs/site-export-config-plan.md` P3. Two small items finalized the site-export pipeline (unlocking Mermaid inlining on export):

- **`.vuepress/public/*` → site root**: in vuepress flavor, exportSite additionally reads `<docsRoot>/.vuepress/public` directly. **Checkpoint finding: Rust `read_directory` hidden-file/directory skipping applies only to listed children; directly reading a hidden directory itself works**—zero new Rust commands; `export_site` disk writes also do not filter dot-prefixed paths. `collectPublicAssets` (siteGenerator.ts) maps every file in the public tree (including .md—the public convention is verbatim mirroring) to site-root assets. Collision rules: public overrides an ordinary asset with the same relPath (warn log); a public entry colliding with a page htmlPath is dropped (page wins). Navigation still falls back to directory inference (sidebar is executable JS and is not parsed, plan decision 2).
- **Regex extraction of config title**: `vuepressSiteTitle` (siteConfig.ts) first strips block comments and full-line `//` comments (the case repository had commented-out config entries), then takes the first `title: '...'/"..."/\`...\`` match (`.` does not cross lines; a title inside themeConfig appears after top level and therefore does not win); escaped quotes are restored and whitespace trimmed. Detection `readVuepressSiteName` tries config.ts → config.js → config.mjs and stops on the first hit; read failures degrade to warning only (best-effort does not block export). Site-name chain: mkdocs `site_name` → vuepress config title → directory name.

**devdocs real-repository acceptance** (one-off integration probe: invoke replicated Rust semantics with node:fs to run real `exportSite()`; all 38 pages and 40 assets passed; probe deleted afterward): scope narrowed to docs/, original nav + external links, rn/ and old API hidden pages exported but not in nav, frontmatter stripped, 24 `!!!` renderings, PlantUML inlining connected, `.md` cross-links rewritten, image assets mirrored, zero `.vuepress`/`.DS_Store` leakage. Real-repository verification exposed two unit-test blind spots (both fixed):

- **`file_exists` recognized files but not directories**: the original Rust implementation returned `exists && is_file`, while flavor detection's `docs_dir` existence check, `.vuepress` detection, `.vuepress/public` check, and file-tree Create Copy name precheck all pass directories—always false on real devices, completely breaking MkDocs scope narrowing and VuePress flavor detection (unit-test fakeIo treated directories as existing and hid this). Changed to true for any existing path (file or directory). **Lesson: path-mock semantics must align with the Rust command implementation one by one; only real-repository end-to-end testing exposed this.**
- **Site export had been “accidentally correct” through a readFile-failure fallback**: `isLocalPath` recognizes `./` prefixes, so `parseMarkdownAsync` without baseDir also attempted base64 inlining for relative images (the PDF-specific path); site export retained relative src only because relative-path readFile necessarily failed and fell back. With `preserveImages`, `preprocessImages` is now skipped entirely (regression test in parser.test.ts).

## 2026-08-17 MkDocs `!!!` Admonitions in Both Editors + exclude_docs (Site-Export Config Awareness P2)

Plan: `docs/site-export-config-plan.md` P2. Key difference between `!!!` (Python-Markdown style) and `:::`: **no closing fence; content extends across subsequent lines indented by 4 spaces/tab** (blank lines can hang: if an indented line follows a blank line, both belong to the container).

**Preview/Split (`src/lib/markdown/bangAdmonitionPlugin.ts`)**: custom block rule (`md.block.ruler.before('fence')`, same alt as markdown-it-container so it can interrupt paragraphs and nest in quotes/lists)—markdown-it-container cannot be reused (it requires paired fences). After matching the marker line, collect indented content lines (`sCount - blkIndent >= 4` or blank), dedent one level (4 spaces or 1 tab), and recursively parse full blocks through `state.md.block.parse` (nested `!!!` and fenced code inside containers use standard mechanisms). Output HTML is byte-structurally identical to `:::` containers (CSS/tests lock that structure). **Unknown types (MkDocs extension types abstract/question/...) degrade visually to the note theme, with the original type name as default title**.

**WYSIWYG (text-preprocessing route)**: indentation information is already erased at mdast level by commonmark (a `!!!` block becomes “marker-line merged paragraph + indented-code-block sibling”), so parsing does not occur in the remark transform—`preprocessBangAdmonitions` in `src/lib/markdown/bangAdmonition.ts` converts `!!!` indented blocks to **internal `:::!` form** before Milkdown parsing (encoding bang origin), connected at both Markdown entries in `WysiwygEditor.tsx` (`defaultValueCtx` / both `replaceAll` calls; tests need the same manual wrapping). admonitionPlugin's extended START_MARKER recognizes `:::!` and sets PM node attr `syntax: 'bang'`; serialization branches on that attr to output `!!! type "title"` + every content line indented 4 spaces—**syntax-preserving round trip (!!! in, !!! out), never normalized to `:::`** (which would break the user's MkDocs build).

Pitfall controls:

- **Internal `:::!` leak prevention**: internal form exists only in transient text. Bang pairing uses depth counting (colon uses nearest-end alignment, matching markdown-it-container's equal-length fence behavior); **a bang block whose content contains `:::` markers is not converted at all** (colon-in-bang pairing can become incorrect; degrading to source is better than rewriting user source); hand-written unmatched `:::!` degrades entirely to literal paragraphs. Tests lock all of these.
- **Preprocessor skips**: inside fenced code blocks (fence-state tracking), and passes through entire `:::` containers; `!!!` inside quotes/lists is a known boundary (lines beginning `>`/list markers are not converted and remain undamaged; preview renders them normally through markdown-it's block mechanism).
- **Fence-mask relaxation**: FENCE_BLOCK_REGEX indentation in parser.ts widened from ` {0,3}` to `[ \t]*`—`!!!` content is indented 4 spaces overall, and fences inside it would otherwise escape masking and be incorrectly replaced by the inline `@startuml` regex; masks restore verbatim before rendering, so widening has no effect on top-level rendering (also fixing the old boundary where `@startuml` inside a top-level indented code block was replaced).
- **Unknown-type nodeview**: class uses `admonitionDisplayClass` (unknown → note theme), while data attrs and PM attrs preserve the original type name for lossless serialization.
- Title serialization always uses quoted form (unquoted titles normalize on first round trip); titles containing double quotes fall back to unquoted source. Empty containers output only the marker line (`!!! note`).

**exclude_docs (MkDocs 1.5+, P2.3)**: `parseMkdocsConfig` parses it (official multiline strings + compatible YAML arrays; strips inline comments/blank lines); `compileExcludePatterns`/`isExcludedPath` (siteConfig.ts) implement .gitignore semantics (`!` negation decided by last match, `/` anchored, `*`/`?` do not cross segments, `**` does, trailing `/` directories only); `filterFileTreeByExcludes` (siteGenerator.ts) filters after exportSite reads the tree—**pages and assets are both filtered, with paths relative to docs_dir**. This is the only config that removes exported content (nav is only a navigation allowlist); when nav points to an excluded file, existing missingPaths skipping + logging applies. MkDocs implicit defaults (`.*`, `/templates/`) are not replicated: Rust directory reads already skip dotfiles, and `/templates/` is an MkDocs theme concept with no meaning for the built-in generator.

## 2026-08-18 Fullscreen Diagram/Image Viewer (ImageLightbox, GitHub-Style Zoom)

Requirement: enlarged Mermaid viewing (matching GitHub's diagram zoom/fullscreen controls). Final design: **fullscreen viewer (lightbox)** covering Mermaid + PlantUML + ordinary Markdown images in both Preview and WYSIWYG.

**Architecture**: global singleton `src/components/ImageLightbox.tsx` mounted in App.tsx, opened through the existing CustomEvent bus—`app-open-image-viewer`, `detail: { html }` (outerHTML of the viewed svg/img). All pure logic lives in `src/lib/diagramZoom.ts` (fitScale/clampScale/zoomAtPoint anchor math/resolveViewerTarget hit detection/naturalSizeOf dimension reading), unit-testable.

**Three entries:**

- Preview click: `Editor.tsx handlePreviewClick` adds diagram/image branches **after** the link branch (links return first; `<a>` inside Mermaid and link-wrapped img naturally take priority and do not accidentally open the viewer). Hit rules (`resolveViewerTarget`): diagram containers (`.mermaid-diagram`/`.plantuml-diagram`) use inline svg, falling back to an unbroken img without svg (PlantUML online-fallback state); loading/error/broken-image states return null; otherwise use an ordinary img inside `.markdown-body`.
- WYSIWYG diagram block: `plantUmlCodeBlockView.ts` adds a hover zoom button to the block container (outside contentDOM), dispatching only when preview has viewable content; `stopEvent` covers the button (PM does not intercept the click).
- WYSIWYG image: same button in `imageView.ts` (shared creator `viewerZoomButton.ts`); **image clicks are not hijacked** (retaining PM node selection), and broken-image placeholders do not open.
- Button i18n uses imperative `i18n.t()` (nodeviews are not React); the react-i18next mock table in test setup.ts must add matching `imageViewer.*` keys.

**Interaction**: initial fit (large images shrink into 92%vw×88%vh, small images stay 1:1 without enlargement, lower bound MIN_SCALE); wheel zoom anchors at the cursor (0.1×–8×, **must use `passive: false` + preventDefault**, coordinates originate at viewport center with transform origin center); pointer capture drag-pans; double-click/button/keyboard 0 resets; Esc or blank-area click closes (click after a >4px drag does not). **Zoom/pan state uses refs + direct DOM transform writes**—high-frequency wheel/drag operations do not trigger React rerenders; only percentage display uses state. On open, focus the overlay (tabIndex -1) so keyboard +/-/0/Esc do not reach the background editor.

**Injected-content normalization** (`naturalSizeOf` + open effect): svg removes width/height attrs and sets `maxWidth: none`, reading original dimensions from viewBox → numeric attributes → getBBox (try/catch; jsdom has no layout) and setting explicit pixel width/height; img uses `maxWidth: none` (overriding Tailwind preflight `max-width: 100%`, otherwise zoom cannot exceed viewport width), with once load attached if naturalWidth is not ready—**automatic refit occurs only before the user manually zooms/pans**. The cloned Mermaid SVG shares `url(#id)` marker references with the original document (the original remains in DOM with identical definitions, rendering consistently; common industry practice).

**CSS (last section of globals.css)**: preview `cursor: zoom-in` + diagram-card hover magnifier corner badge (`::after` purely decorative, `pointer-events: none`, `:has()` excludes loading/error states); **scope must be limited to `.markdown-body:not(.wysiwyg-editor)`**—the WYSIWYG root has both `.markdown-body` and `.wysiwyg-editor`, and its diagrams/images use buttons rather than badge/zoom-in cursor. Lightbox z-index 60 (Dialog is 50), toolbar/overlay use CSS variables in both themes. **Content must sit on an opaque card (`--editor-bg` + padding 16, included in fit calculation)**—Mermaid/PlantUML SVG backgrounds are transparent, and placing them directly over the translucent overlay reveals document content underneath and makes lines/text hard to read (found during acceptance; GitHub's viewer likewise uses an opaque background).

**jsdom test adaptation**: viewport clientWidth 0 → component falls back to `window.innerWidth` (1024×768); async img path uses `Object.defineProperty(naturalWidth/Height)` + `fireEvent.load` to trigger refit.

Tests: diagramZoom.test.ts (math + all hit branches + dimension reading), ImageLightbox.test.tsx (open/three close paths/button and keyboard zoom/async img refit), button cases in both nodeviews; E2E `e2e/mermaid.spec.ts` adds real-engine coverage (click to open viewer → zoom 125% → reset → Esc → reopen and click blank area to close).

## 2026-08-18 File Watching (Automatic Reload on External Changes, Phase 5 Completion)

Requirement: automatically detect changes to the currently open file made by external programs (VS Code/git checkout/scripts). Conflict strategy was designed alongside multi-window and auto-save.

**Architecture**: custom Rust module `src-tauri/src/file_watch.rs` (`notify = "6.1"`, not tauri-plugin-fs-watch—per-window targeted emit and controlled debounce were required, while the plugin broadcasts globally without debounce control). One watcher per window (SDI single document), label → WatchEntry registry; commands `watch_file` / `unwatch_file`; window `Destroyed` hook (lib.rs on_window_event) releases it.

**Key decisions:**

- **Watch the parent directory (NonRecursive) and filter by target path**, rather than watching the file directly—FSEvents is directory-level anyway, and atomic saves (write tmp + rename swapping inode) lose direct file watchers. Event paths and input paths may differ in form (symlink), so compare both before and after canonicalization.
- **Debounce in Rust**: events enter mpsc, and a dedicated thread waits for a 300ms quiet period before reclassifying changed/removed through `fs::metadata`—not relying on notify event types, so boundaries such as rename-away naturally become removed. Watcher drop → sender disconnects → thread exits by itself, with no explicit stop signal.
- **Echo suppression in frontend** (`src/lib/fileWatcher.ts`): `lastKnownContent` = the disk content we most recently read or wrote, updated at four points: successful open/save/reload/conflict-keep (fileOps.ts instrumentation `markFileContentKnown`). A watch event first reads disk through `read_file` and compares; equality means our own write echo and is ignored. No Rust cooperation is needed.

**Routing** (pure function `decideWatchAction`, main unit-test target): disk==lastKnown → ignore; external modification + clean → silent reload (setContent+setDirty(false), reusing the open-file store→editor sync chain, with existing CM/WYSIWYG effects as fallback); external modification + dirty → conflict dialog “Reload/Keep My Changes” (Dialog's first custom button labels through dialogStore.ask's third labels argument); external deletion → alert once (removedNotified idempotent, reset after save recreates), retaining filePath so the next save recreates through save_file's create_dir_all+write.

**Auto-save race**: while a conflict dialog is unresolved, `useAutoSave` skips (`isWatchConflictPending()`)—otherwise its 2s timer could silently overwrite the external version before the user chooses. Skipping does not reschedule the timer; the next keystroke resumes naturally (nothing should be written while the decision is pending anyway). “Reload” **rereads disk** (it may have changed again during the dialog); “Keep” records the current disk version as lastKnown—the next save overwrites it, and duplicate bursts of that event do not reopen the dialog.

**Boundaries**: always on with no setting; watches only the current document (not file tree/folder); no watcher in browser dev/E2E (isTauri gate); reload preserves neither cursor nor scroll (same as opening a file; can be iterated later).

Tests: 13 cases in fileWatcher.test.ts (all decideWatchAction branches + event-flow integration—reload/echo/both conflict branches/ignore-while-pending/idempotent deletion/path filtering/watch switching).

## 2026-10-18 MkDocs `???` Collapsible Admonitions (Preview/Export)

`src/lib/markdown/collapsibleAdmonitionPlugin.ts` registers an independent markdown-it block rule for `??? type ["title"]`. Content boundaries follow MkDocs's 4-space/tab indentation and recursive block parsing; HTML uses native `<details>` / `<summary>` without an `open` attribute, and content reuses `.admonition-content` and existing type colors. This rule is attached only to the preview/export parser; WYSIWYG adaptation is outside this scope. Unit tests covering default/custom titles, unknown types, nested lists/fenced code, async export, and error markers live in `src/lib/markdown/__tests__/collapsibleAdmonitionPlugin.test.ts`.
