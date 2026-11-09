# VividMark Design System

**English | [简体中文](DESIGN_SYSTEM.zh-CN.md)**

VividMark uses a lightweight design system with no additional dependencies: **Tailwind CSS 4 + CSS design tokens + shared React components**. Its goal is to preserve the restrained, dense desktop interface inspired by Typora while giving colors, dimensions, and component behavior a single source of truth instead of reinventing styles in every UI.

## Principles

1. **Tokens first**: New UI must not use hexadecimal colors, Tailwind gray palettes, or static inline font sizes directly.
2. **Components first**: Use `src/components/ui/` for standard buttons, text inputs, and modals instead of copying another set of button or overlay styles.
3. **Semantic naming**: Business components use semantic colors for backgrounds, surfaces, borders, and primary/secondary text rather than separate light- and dark-theme values.
4. **Incremental migration**: Legacy CSS variables remain available. Migrate old components to semantic classes and shared components when touching them; a wholesale UI rewrite is not required.
5. **Domain styles stay separate**: Markdown rendering, code highlighting, Admonition colors, and other domain-specific styles remain in `globals.css`; do not force them into application control components.

## File Responsibilities

| Location | Responsibility |
| --- | --- |
| `src/styles/tokens.css` | Single source of design tokens: Tailwind theme mappings, colors, fonts, spacing, radii, control heights, motion, and shadows |
| `src/styles/globals.css` | Global base styles and domain styles for Markdown, code highlighting, and similar rendering; imports `tokens.css` |
| `src/components/ui/` | Shared components without business semantics |
| `src/components/Menu/` | Specialized menu primitives for dropdowns, context menus, and the menu bar |
| `src/components/__tests__/designGuard.test.ts` | Static checks that reject hardcoded visual styles in components |

## Design Tokens

### Colors

Prefer Tailwind semantic classes in components. The corresponding CSS variables remain available when working with legacy code.

| Semantics | Tailwind example | CSS variable |
| --- | --- | --- |
| Page / editor background | `bg-background` | `--editor-bg` |
| Sidebar / primary surface | `bg-surface` | `--sidebar-bg` |
| Toolbar background | `bg-toolbar` | `--toolbar-bg` |
| Border / divider | `border-border` | `--editor-border` |
| Primary text | `text-foreground` | `--text-primary` |
| Secondary text | `text-secondary` | `--color-text-secondary` |
| Placeholder / disabled text | `text-muted` | `--color-text-muted` |
| Accent / focus | `bg-accent`, `text-accent` | `--accent-color` |
| Accent hover | `hover:bg-accent-hover` | `--accent-hover` |
| Text on accent | `text-on-accent` | `--on-accent` |
| Neutral hover / active | `bg-hover`, `bg-active` | `--hover-bg`, `--active-bg` |
| Destructive action | `bg-danger`, `text-danger` | `--danger-color` |
| Modal overlay | `bg-overlay` | `--overlay-color` |

Light and dark themes only change token values under `:root` and `.dark`; business components must not add separate `.dark` color branches.

### Fonts and Typography

- `--font-ui`: Application UI font stack; also mapped to Tailwind `font-sans`.
- `--font-code`: Code and monospaced text; also mapped to `font-mono`.
- Font-size tokens are 10 / 12 / 13 / 14 / 16 / 18 / 20px under `--font-size-*`.
- Standard body text and buttons use Tailwind `text-sm` (14px); dense lists and supporting text use `text-xs` (12px) or the existing 13px density specification.
- Editor zoom still calculates font sizes dynamically in editor logic; this is not a static inline-font-size violation.

### Spacing, Radii, and Dimensions

- Spacing follows a 4px grid with tokens from `--space-1` through `--space-8`; prefer equivalent Tailwind scales such as `p-2`, `gap-3`, and `mt-6` for layout.
- Radii are 2 / 4 / 6 / 8 / 10px: `rounded-xs` / `rounded-sm` / `rounded-md` / `rounded-lg` / `rounded-xl`.
- Control heights are compact 28px, standard 32px, and relaxed 36px through `--control-height-sm` / `md` / `lg`.
- Motion uses `--duration-fast` (150ms) and `--duration-normal` (200ms).
- Modals and floating layers use `shadow-overlay`; do not assemble new shadow color values in business components.

## Shared Components

Import them from `src/components/ui`.

### Button

```tsx
<Button onClick={handleSave}>Save</Button>
<Button variant="secondary" onClick={onClose}>Cancel</Button>
<Button variant="ghost" size="sm">More</Button>
<Button variant="danger">Delete</Button>
<Button variant="secondary" size="icon" aria-label="Add">+</Button>
```

- Variants: `primary` (default), `secondary`, `ghost`, and `danger`.
- Sizes: `md` (32px default), `sm` (28px), and `icon` (32×32px).
- Defaults to `type="button"` to prevent accidental form submission; supports `ref`, disabled state, and native button attributes.
- Controls with specialized interaction roles—menu items, window controls, segmented selectors, and similar—may keep dedicated components.

### TextField

```tsx
<TextField value={title} onChange={(event) => setTitle(event.target.value)} />
<TextField inputSize="sm" placeholder="Filter files" />
<TextField invalid aria-label="Required field" />
```

`TextField` standardizes background, border, focus ring, placeholder, and disabled state. `inputSize` avoids conflicting with the native input `size` attribute.

### Modal

```tsx
<Modal onClose={onClose} className="w-96" aria-label={t('settings.title')}>
  <ModalContent />
</Modal>
```

`Modal` standardizes the overlay, panel, shadow, Escape-to-close, and overlay-click-to-close behavior. Callers provide the title, content, and footer actions; mount the component only while open. Business shortcuts such as Enter in confirmation dialogs and Mod+Enter in insertion dialogs remain the caller's responsibility.

## Adding UI

1. Check `src/components/ui/` and `src/components/Menu/` for a suitable existing component.
2. Check `tokens.css` for colors and dimensions. If a new specification is genuinely needed, add a semantic token instead of a literal color in a business component.
3. Reuse shared components and supply layout through `className`; do not copy their internal visual styles.
4. Add behavior tests for new components. For visual changes, run at least the relevant component tests and `designGuard.test.ts`.
5. When adding tokens or components, or changing these conventions, update this document and the concise guidance in `AGENTS.md` together.

## Current Migration Coverage

Migrated: confirmation/alert dialogs, Settings, About, Insert Table, Insert Admonition, Open Folder button, file-tree filtering and inline naming, recent-file filtering, and the destructive hover color of the Windows close button.

The design guard currently checks hexadecimal colors, hardcoded neutral palettes such as Tailwind Gray and Slate, static inline `fontSize`, and string inline `fontFamily`. It is intentionally a lightweight static check and does not replace code review or real-UI acceptance.
