# VividMark

A modern, lightweight Markdown editor built with Tauri 2.0 and React. Inspired by Typora, featuring a clean, distraction-free writing experience with real-time preview.

**Perfect for MkDocs**: Full support for MkDocs-specific syntax including admonitions (callout boxes), PlantUML diagrams, and advanced tables — making it an ideal editor for writing and previewing MkDocs documentation.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![AI-Built](https://img.shields.io/badge/100%25%20AI-Built-purple.svg)

**English | [简体中文](README.zh-CN.md)**

## 🌐 Website

Visit the project website: **[https://scottli139.github.io/vividmark](https://scottli139.github.io/vividmark)**

## Features

### Core Editor
- **Four view modes** - WYSIWYG (seamless live editing, default), Source, Preview (read-only), Split (side-by-side with sync scrolling)
- **CodeMirror 6 editing** - Markdown syntax highlighting, smart list continuation, auto-closing brackets, Tab indentation
- **Real-time Markdown preview** - See your formatted content instantly
- **Find & replace** - Built-in search panel with Cmd/Ctrl + F
- **Status bar** - Word count, cursor position, and zoom level at a glance
- **Code syntax highlighting** - Powered by highlight.js

### File Operations
- **Open/Save/Save As** - Full file management support with native dialogs
- **Keyboard shortcuts** - Cmd/Ctrl + O, S, N for quick access
- **Drag & drop** - Drop Markdown files to open instantly
- **Auto-save** - Automatic saving after 2 seconds of inactivity
- **Recent files** - Quick access to recently opened files
- **Native menus** - System menu bar with localized labels, dynamic Open Recent, and OS-level shortcuts
- **Undo/Redo** - Full history support with Cmd/Ctrl + Z / Shift+Z

### Formatting Tools
- **Inline formatting** - Bold, Italic, Strikethrough, Inline code, Links (Cmd/Ctrl + B / I / K)
- **Block formatting** - Headings (H1-H6), Quote, List, Code block
- **Image insertion** - Toolbar, paste, or drag & drop with automatic asset management
- **Table editing** - Visual table creation with customizable rows and columns

### MkDocs-Ready: Extended Markdown Support
- **Tables** - Full GFM table support with alignment
  ```markdown
  | Name  | Age | City  |
  |:------|:---:|------:|
  | Alice | 25  | NYC   |
  | Bob   | 30  | LA    |
  ```

- **Admonitions** - Beautiful callout boxes for tips, warnings, notes, etc.
  ```markdown
  ::: tip
  This is a helpful tip!
  :::

  ::: warning Important
  This is a warning with custom title.
  :::
  ```
  Supported types: `tip`, `warning`, `info`, `note`, `danger`, `success`, `hint`, `important`, `caution`

- **PlantUML Diagrams** - Render UML diagrams directly in your document
  ```markdown
  @startuml
  Alice -> Bob: Hello
  Bob --> Alice: Hi!
  @enduml
  ```

### User Interface
- **Multi-language support** - English and 简体中文 (Simplified Chinese), easily extensible to more languages
- **Theme modes** - Light, Dark, or Auto (follows system appearance)
- **Settings panel** - Appearance, language, and sidebar preferences in one place
- **Sidebar with outline navigation** - Collapsible outline tree with active-position highlighting and click-to-navigate (works in all view modes)
- **File tree with file management** - Browse folders, filter by name, and create/rename/delete files via the context menu
- **Clean UI** - Minimalist design for focused writing
- **Sync scrolling** - Split mode with bidirectional scroll synchronization

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Tauri 2.0 (Rust)
- **Build Tool**: Vite 7
- **State Management**: Zustand 5
- **Internationalization**: i18next + react-i18next
- **Markdown**: markdown-it with custom plugins
- **Extended Syntax**: markdown-it-container, plantuml-encoder
- **Syntax Highlighting**: highlight.js
- **Testing**: Vitest + React Testing Library + Playwright

## AI Development

This project was **entirely built with AI coding assistants**:

| Tool | Model |
|------|-------|
| [Claude Code CLI](https://github.com/anthropics/claude-code) | GLM model |
| [Kimi CLI](https://www.kimi.com/) | Kimi model |

> 🤖 No human-written code. Every line was generated, reviewed, and refined through AI collaboration.

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Rust (for Tauri)

### Installation

```bash
# Clone the repository
git clone https://github.com/scottli139/vividmark.git
cd vividmark

# Install dependencies
pnpm install

# Start development server
pnpm tauri dev
```

### Build

```bash
# Build for production
pnpm tauri build
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + O` | Open file |
| `Cmd/Ctrl + S` | Save file |
| `Cmd/Ctrl + Shift + S` | Save as |
| `Cmd/Ctrl + N` | New file |
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + K` | Insert link |
| `Cmd/Ctrl + 1 / 2 / 3` | Heading 1 / 2 / 3 |
| `Cmd/Ctrl + F` | Find & replace |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + /` | Toggle WYSIWYG / Source |
| `Cmd/Ctrl + = / - / 0` | Zoom in / out / reset |
| `Escape` | Exit edit mode |

## Project Structure

```
vividmark/
├── src/                    # React frontend
│   ├── components/
│   │   ├── Editor/         # Core editor component
│   │   ├── Sidebar/        # Sidebar with outline
│   │   └── Toolbar/        # Toolbar with actions
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand state management
│   ├── lib/
│   │   ├── markdown/       # Markdown parsing
│   │   └── fileOps.ts      # File operations
│   └── styles/             # Global styles
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Main logic + commands
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml
│   └── tauri.conf.json
└── package.json
```

## Development Status

See [PLAN.md](./PLAN.md) for detailed development progress.

### Completed
- [x] Phase 1: Basic framework
- [x] Phase 2: Core editor
- [x] Phase 3: File operations
- [x] Phase 4: Editing enhancements (View modes, Image insertion, Undo/Redo, MkDocs extensions, Table editing, Multi-language support, Outline navigation)
- [x] Phase 8: Code standards (ESLint, Prettier, TypeScript strict mode)
- [x] Phase 9: Testing infrastructure (Vitest, Playwright, CI/CD)
- [x] Phase 10: Branding (Logo, icons)
- [x] Phase 11: Logging system

### In Progress / Planned
- [ ] Phase 5: File management (File tree, Multi-tabs)
- [ ] Phase 6: Advanced features (PDF export, Search & replace)
- [ ] Phase 7: Polish & optimization (Performance, Preferences)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Typora](https://typora.io/)
- Built with [Tauri](https://tauri.app/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
