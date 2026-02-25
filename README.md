# VividMark

A modern, lightweight Markdown editor built with Tauri 2.0 and React. Inspired by Typora, featuring a clean, distraction-free writing experience with real-time preview.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)

## Features

### Core Editor
- **Block-level editing** - Click to edit, blur to render
- **Real-time Markdown preview** - See your formatted content instantly
- **Code syntax highlighting** - Powered by highlight.js
- **Smooth transitions** - Optimized block switching experience

### File Operations
- **Open/Save/Save As** - Full file management support
- **Keyboard shortcuts** - Cmd/Ctrl + O, S, N
- **Drag & drop** - Drop Markdown files to open
- **Auto-save** - Automatic saving after 2 seconds of inactivity
- **Recent files** - Quick access to recently opened files

### Formatting Tools
- **Inline formatting** - Bold, Italic, Strikethrough, Inline code, Links
- **Block formatting** - Headings (H1-H3), Quote, List, Code block

### User Interface
- **Dark mode** - Toggle between light and dark themes
- **Sidebar** - Document outline and file statistics
- **Clean UI** - Minimalist design for focused writing

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Tauri 2.0 (Rust)
- **Build Tool**: Vite
- **State Management**: Zustand
- **Markdown**: markdown-it
- **Syntax Highlighting**: highlight.js

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

### In Progress
- [ ] Phase 4: Editing enhancements
- [ ] Phase 5: File management
- [ ] Phase 6: Advanced features
- [ ] Phase 7: Polish & optimization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Typora](https://typora.io/)
- Built with [Tauri](https://tauri.app/)
- UI components styled with [Tailwind CSS](https://tailwindcss.com/)
