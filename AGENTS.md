# VividMark - Agent Guide

This document provides essential information for AI coding agents working on the VividMark project.

## Project Overview

**VividMark** is a modern, lightweight Markdown editor built with **Tauri 2.0** and **React 19**. It provides a Typora-inspired, distraction-free writing experience with real-time Markdown preview and block-level editing.

### Key Features

- Block-level editing (click to edit, blur to render)
- Real-time Markdown preview with code syntax highlighting
- File operations (Open/Save/Save As) with native dialogs
- Auto-save after 2 seconds of inactivity
- Drag & drop file opening
- Dark mode support
- Recent files list
- Formatting toolbar (Bold, Italic, Headings, Lists, etc.)

## 当前任务看板 📋

> 快速了解项目当前状态，详细计划见 [`PLAN.md`](./PLAN.md)

### 🚧 当前迭代（进行中）

| 优先级 | 任务 | 状态 | 备注 |
|--------|------|------|------|
| P1 | 数学公式 (KaTeX) | ⏳ 待开始 | Phase 4 剩余任务 |
| P1 | **任务列表 (Checkbox)** | ✅ 已完成 | 支持 `- [ ]` 和 `- [x]` 语法，可点击切换，工具栏按钮 |
| P2 | **WYSIWYG 模式** | 🚧 进行中 | Phase 1 完成，四模式共存架构已搭建 |

### ✅ 本次迭代已完成

| 任务 | 说明 |
|------|------|
| **缩放功能** | 支持 50%-200% 内容缩放，工具栏按钮 + 快捷键，状态持久化 |
| **侧边栏文件树** | 支持打开文件夹、递归展开、Markdown 文件过滤、可拖拽调整宽度 |

### 📅 待办队列

| 优先级 | 任务 | 阶段 | 预估工时 |
|--------|------|------|---------|
| ~~P1 | ~~侧边栏文件树~~ | ~~Phase 5~~ | ~~2-3 天~~ | ✅ 已完成 |
| ~~P1 | ~~文件夹打开~~ | ~~Phase 5~~ | ~~1-2 天~~ | ✅ 已完成 |
| P1 | 多标签页 | Phase 5 | 2-3 天 |
| P2 | 文件变更监控 | Phase 5 | 1-2 天 |
| P2 | 导出 PDF/HTML/Word | Phase 6 | 3-5 天 |
| P2 | 搜索与替换 | Phase 6 | 2-3 天 |
| P2 | 偏好设置面板 | Phase 7 | 2-3 天 |

### 🔄 工程优化

| 优先级 | 任务 | 状态 | 备注 |
|--------|------|------|------|
| P2 | E2E 测试增强 | ⏳ 待开始 | 完整用户流程 |
| P2 | 大文件性能优化 | ⏳ 待开始 | Phase 7 |
| P3 | Split 同步滚动优化 | 📋 规划中 | 智能同步算法 |
| P3 | PlantUML 本地渲染 | 📋 规划中 | 离线支持 |

### ⏸️ 暂停/待启动

| 任务 | 文档 | 预计工期 | 阻塞原因 |
|------|------|---------|---------|
| **Typst 离线支持** | [`docs/typst-offline-plan.md`](./docs/typst-offline-plan.md) | 2-3 周 | 等待当前重要任务完成 |

### ✅ 近期已完成

- ~~缩放功能~~ ✅ 2026-03-06 - 支持 50%-200% 内容缩放，工具栏按钮 + 快捷键，状态持久化
- ~~侧边栏文件树~~ ✅ 2026-03 - 支持打开文件夹、递归展开、Markdown 文件过滤、可拖拽调整宽度
- ~~文件夹打开~~ ✅ 2026-03 - 集成到文件树功能中
- ~~外部链接系统浏览器打开~~ ✅ 2026-03
- ~~多语言支持 (i18n)~~ ✅ 2026-03
- ~~大纲视图点击跳转~~ ✅ 2026-03
- ~~表格编辑~~ ✅ 2026-03
- ~~撤销/重做修复~~ ✅ 2026-03
- ~~图片插入与预览~~ ✅ 2026-03
- ~~图片路径 Windows 兼容性~~ ✅ 2026-03
- ~~日志与诊断系统~~ ✅ 2026-03
- ~~CI/CD 自动化测试~~ ✅ 2026-03

---

## Technology Stack

| Category | Technology |
|----------|------------|
| Frontend Framework | React 19 + TypeScript |
| Desktop Framework | Tauri 2.0 (Rust) |
| Build Tool | Vite 7.x |
| Styling | Tailwind CSS 4.x |
| State Management | Zustand 5.x |
| Internationalization | i18next + react-i18next |
| Markdown Parser | markdown-it |
| Syntax Highlighting | highlight.js |
| Testing (Unit) | Vitest + React Testing Library |
| Testing (E2E) | Playwright |
| Linting | ESLint (flat config) |
| Formatting | Prettier |

## Project Structure

```
vividmark/
├── src/                          # React frontend
│   ├── components/               # React components
│   │   ├── Editor/               # Core editor component
│   │   ├── Sidebar/              # Sidebar with outline & stats
│   │   └── Toolbar/              # Toolbar with actions
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAutoSave.ts        # Auto-save functionality
│   │   ├── useFileDragDrop.ts    # Drag & drop handling
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useTextFormat.ts
│   │   └── useHistory.ts
│   ├── stores/                   # Zustand state management
│   │   └── editorStore.ts        # Main editor state
│   ├── lib/                      # Utilities & helpers
│   │   ├── markdown/             # Markdown parsing
│   │   ├── fileOps.ts            # File operations (Tauri)
│   │   ├── logger.ts             # Logging system
│   │   ├── historyManager.ts     # Undo/redo logic
│   │   └── imageUtils.ts         # Image handling
│   ├── styles/                   # Global styles
│   │   └── globals.css           # Tailwind + custom styles
│   ├── test/                     # Test utilities
│   │   ├── setup.ts              # Vitest setup
│   │   └── mocks/tauri.ts        # Tauri API mocks
│   ├── main.tsx                  # Entry point
│   └── App.tsx                   # Root component
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs                # Main logic + Tauri commands
│   │   └── main.rs               # Entry point
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/                    # App icons
├── e2e/                          # Playwright E2E tests
│   └── app.spec.ts
└── dist/                         # Build output
```

## Build & Development Commands

### Development

```bash
# Start Vite dev server only
pnpm dev

# Start Tauri development (frontend + Rust backend)
pnpm tauri:dev
```

### Building

```bash
# Build frontend for production
pnpm build

# Build full Tauri application
pnpm tauri:build
```

### Testing

```bash
# Run unit tests (Vitest, watch mode)
pnpm test

# Run unit tests once
pnpm test:run

# Run tests with coverage report
pnpm test:coverage

# Run E2E tests (Playwright)
pnpm test:e2e
```

### Code Quality

```bash
# Run ESLint
pnpm lint

# Fix ESLint issues
pnpm lint:fix

# Format code with Prettier
pnpm format

# Check formatting
pnpm format:check
```

## Code Style Guidelines

### TypeScript/JavaScript

- **Indentation**: 2 spaces (configured in `.editorconfig` and `.prettierrc`)
- **Semicolons**: Disabled
- **Quotes**: Single quotes for JS/TS, double quotes for JSX
- **Print Width**: 100 characters
- **Trailing Commas**: ES5 compatible

### Rust

- **Indentation**: 4 spaces (per `.editorconfig`)
- Follow standard Rust naming conventions (`snake_case` for functions/variables)

### File Naming

- Components: PascalCase (e.g., `Editor.tsx`, `Toolbar.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAutoSave.ts`)
- Utilities: camelCase (e.g., `fileOps.ts`, `logger.ts`)
- Tests: Co-located with source files in `__tests__/` folders or `.test.ts` suffix

### Import Order

1. React imports
2. Third-party libraries
3. Absolute project imports (`@/components/...`)
4. Relative imports (`../stores/...`)
5. Type imports

## Testing Strategy

### Unit Tests (Vitest)

- **Location**: Co-located with source files in `__tests__/` directories
- **Environment**: jsdom
- **Coverage**: v8 provider

```typescript
// Example test pattern
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<Component />)
    expect(screen.getByText('Expected')).toBeInTheDocument()
  })
})
```

### E2E Tests (Playwright)

- **Location**: `e2e/` directory
- **Base URL**: `http://localhost:5173`
- Uses Vite dev server for testing (not Tauri)

### Mocking Tauri APIs

Use the provided mocks in `src/test/mocks/tauri.ts`:

```typescript
import { mockInvoke, resetTauriMocks, setupDefaultTauriMocks } from '../test/mocks/tauri'

beforeEach(() => {
  resetTauriMocks()
  setupDefaultTauriMocks()
})
```

---

## Zoom / 缩放功能

支持编辑器内容区域的缩放（50% - 200%）。

### 功能特性

- **缩放范围**: 50% - 200%，步进 10%
- **工具栏控制**: 显示当前百分比，放大/缩小/重置按钮
- **快捷键支持**:
  - `Cmd/Ctrl + +` 或 `Cmd/Ctrl + =` - 放大
  - `Cmd/Ctrl + -` - 缩小
  - `Cmd/Ctrl + 0` - 重置为 100%
- **状态持久化**: 缩放级别自动保存到本地存储

### 实现细节

**Store 状态** (`editorStore.ts`):
```typescript
zoomLevel: number  // 默认 100
setZoomLevel: (level: number) => void
zoomIn: () => void   // +10%，上限 200%
zoomOut: () => void  // -10%，下限 50%
zoomReset: () => void // 重置为 100%
```

**应用缩放** (`Editor.tsx`):
```typescript
// Source / Split / Preview 模式下都支持
<textarea style={{ zoom: `${zoomLevel}%` }} />
<div style={{ zoom: `${zoomLevel}%` }} />
```

**快捷键处理**:
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

---

## State Management (Zustand)

The main store is `editorStore.ts` with persistence for user preferences:

```typescript
import { useEditorStore } from './stores/editorStore'

// Reading state
const { content, isDirty } = useEditorStore()

// Using actions
const setContent = useEditorStore(state => state.setContent)
setContent('new content')
```

### Persisted State

- `recentFiles`: List of recently opened files
- `isDarkMode`: Theme preference
- `language`: UI language preference

### Non-Persisted State

- `content`: Current document content
- `filePath`/`fileName`: Current file info
- `isDirty`: Unsaved changes flag
- `viewMode`: Current view mode (edit/preview/split)

## Internationalization (i18n)

The project uses **i18next** + **react-i18next** for internationalization.

### Supported Languages

- `en` - English (default)
- `zh-CN` - 简体中文 (Simplified Chinese)

### Adding a New Language

1. Create translation file `src/i18n/locales/{lang}.json`
2. Add language to `src/i18n/index.ts`:

```typescript
export const availableLanguages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'your-lang', name: 'Language Name', flag: '🇨🇳' },
]
```

3. Import and add to resources:

```typescript
import yourLang from './locales/your-lang.json'

export const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
  'your-lang': { translation: yourLang },
}
```

### Using Translations in Components

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()

  return (
    <button title={t('toolbar.tooltip.save', { shortcut: 'Cmd+S' })}>
      {t('toolbar.viewMode.source')}
    </button>
  )
}
```

### Translation File Structure

```json
{
  "toolbar": {
    "tooltip": {
      "save": "Save ({{shortcut}})"
    },
    "viewMode": {
      "source": "Source"
    }
  },
  "welcome": {
    "title": "Welcome to VividMark"
  }
}
```

### Language Switching

Language is persisted in Zustand store and automatically synced with i18next:

```typescript
const { language, setLanguage } = useEditorStore()

// Change language
setLanguage('zh-CN')
```

The `App.tsx` component automatically syncs the store language with i18next on mount.

## Tauri Commands (Rust Backend)

Available invoke commands from frontend:

| Command | Parameters | Returns | Description |
|---------|-----------|---------|-------------|
| `read_file` | `{ path: String }` | `FileInfo` | Read file content |
| `save_file` | `{ path, content }` | `SaveResult` | Write file content |
| `file_exists` | `{ path: String }` | `bool` | Check file existence |

### FileInfo Structure

```typescript
interface FileInfo {
  path: string
  content: string
  name: string
}
```

## Keyboard Shortcuts

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| `Cmd/Ctrl + O` | Open file | `useKeyboardShortcuts.ts` |
| `Cmd/Ctrl + S` | Save file | `useKeyboardShortcuts.ts` |
| `Cmd/Ctrl + Shift + S` | Save as | `useKeyboardShortcuts.ts` |
| `Cmd/Ctrl + N` | New file | `useKeyboardShortcuts.ts` |
| `Cmd/Ctrl + =/+` | Zoom in | `Editor.tsx` |
| `Cmd/Ctrl + -` | Zoom out | `Editor.tsx` |
| `Cmd/Ctrl + 0` | Reset zoom | `Editor.tsx` |
| `Escape` | Exit edit mode | `Editor.tsx` |

## Logging

### Frontend Logging

Use the centralized logger for consistent logging:

```typescript
import { createLogger, fileOpsLogger } from './lib/logger'

// Use pre-configured logger
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
[14:32:01] [System] Architecture: aarch64
[14:32:01] [System] Log directory: "/Users/xxx/Library/Logs/com.vividmark.app"
[14:32:15] [read_file] Starting file read operation
[14:32:15] [read_file] Target path: /Users/xxx/Documents/test.md
[14:32:15] [read_file] Pre-read metadata: size=15234 bytes, permissions="644", modified=Some("2h 15m ago")
[14:32:15] [read_file] ✓ Success: /Users/xxx/Documents/test.md (15234 bytes, 1234 chars) in 2.1ms (~7.12 MB/s)
```

## CI/CD (GitHub Actions)

The project has a GitHub Actions workflow (`.github/workflows/test.yml`) that runs:

1. **Lint job**: ESLint + Prettier check
2. **Typecheck job**: TypeScript compilation check
3. **Unit Tests job**: Vitest with coverage reporting to Codecov
4. **E2E Tests job**: Currently disabled (requires Tauri setup)

## Development Notes

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Rust toolchain (for Tauri)

### Common Issues

1. **Tauri build fails**: Ensure Rust is installed and up to date
2. **Lockfile issues**: Use `pnpm install --frozen-lockfile` in CI
3. **Type errors**: Check `tsconfig.app.json` includes all source files

### Adding New Tauri Commands

1. Add command in `src-tauri/src/lib.rs`:
```rust
#[tauri::command]
fn my_command(arg: String) -> Result<String, String> {
    // Implementation
}
```

2. Register in `run()` function:
```rust
.invoke_handler(tauri::generate_handler![read_file, save_file, file_exists, my_command])
```

3. Invoke from frontend:
```typescript
import { invoke } from '@tauri-apps/api/core'
const result = await invoke<string>('my_command', { arg: 'value' })
```

### Styling Guidelines

- Use Tailwind CSS utility classes
- CSS variables for theme colors (defined in `globals.css`)
- Dark mode: Use `.dark` prefix class
- Editor content: Use `.markdown-body` class for rendered markdown

## Security Considerations

- CSP is currently disabled (`"csp": null` in `tauri.conf.json`)
- File system access is controlled by Tauri capabilities
- Dialog and FS plugins are enabled for native file operations
- No network access required for core functionality

---

## Knowledge Base

### MkDocs-style Extensions Implementation

#### Admonitions (Callout Boxes)

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

#### PlantUML Diagrams

**Dependencies:**
```bash
pnpm add plantuml-encoder
```

**Implementation:**
Two rendering approaches:

1. **Code block syntax** (` ```plantuml ``` `) - handled in highlight function
2. **Inline syntax** (`@startuml...@enduml`) - preprocessed before markdown parsing

```typescript
// Preprocess inline PlantUML
const PLANTUML_INLINE_REGEX = /@startuml([\s\S]*?)@enduml/g

function preprocessPlantUML(content: string): string {
  return content.replace(PLANTUML_INLINE_REGEX, (_match, p1) => {
    const encoded = encode(p1.trim())
    const url = `https://www.plantuml.com/plantuml/svg/${encoded}`
    return `<div class="plantuml-diagram"><img src="${url}" alt="PlantUML" loading="lazy" /></div>\n`
  })
}
```

**Note:** Currently uses PlantUML online service. Offline rendering requires additional setup.

### Windows 路径处理

**问题背景:**
Windows 系统使用 `\` 作为路径分隔符，而 Unix/macOS 使用 `/`。在处理跨平台文件路径时，需要统一处理两种分隔符，否则会导致路径解析错误。

**涉及场景:**
1. **图片插入** - 计算相对路径时（`src/lib/imageUtils.ts`）
2. **Markdown 渲染** - 解析相对路径为绝对路径时（`src/lib/markdown/parser.ts`）
3. **baseDir 计算** - 从文件路径提取目录时（`src/components/Editor/Editor.tsx`）

**解决方案:**
统一将路径转换为 POSIX 风格（使用 `/`）后再进行处理：

```typescript
// 统一转换为 POSIX 风格路径
const normalizedPath = windowsPath.replace(/\\/g, '/')

// 处理路径分隔符（支持 Windows 和 Unix）
const lastSlash = filePath.lastIndexOf('/')
const lastBackslash = filePath.lastIndexOf('\\')
const separatorIndex = Math.max(lastSlash, lastBackslash)
```

**关键函数:**
- `getRelativePath()` - 计算相对路径（imageUtils.ts）
- `resolveRelativePath()` - 解析相对路径为绝对路径（parser.ts）
- Editor.tsx 中的 baseDir 计算

**注意事项:**
- Windows 绝对路径如 `C:\Users\...` 转换后仍为 `C:/Users/...`，Tauri API 可以正常处理
- 相对路径中的 `../` 和 `./` 在转换后保持一致

---

### Outline Navigation (大纲视图点击跳转)

**Implementation Overview:**

1. **Extract Outline from Markdown**
   ```typescript
   // src/lib/outlineUtils.ts
   export interface OutlineItem {
     level: number      // Heading level (1-6)
     text: string       // Heading text
     lineIndex: number  // Line number in content
     charIndex: number  // Character position for textarea navigation
     index: number      // Heading index for preview navigation
   }
   
   export function extractOutline(content: string): OutlineItem[]
   ```

2. **Navigation in Different View Modes**
   
   | Mode | Navigation Method | Implementation |
   |------|------------------|----------------|
   | Source | Scroll textarea + cursor | `scrollToPosition(textarea, charIndex)` |
   | Split | Scroll textarea + cursor | `scrollToPosition(textarea, charIndex)` |
   | Preview | Scroll to heading element | `scrollPreviewToHeading(container, index)` |

3. **Component Communication via CustomEvent**
   ```typescript
   // Sidebar dispatches event
   window.dispatchEvent(
     new CustomEvent('editor-scroll-to-heading', {
       detail: { charIndex, lineIndex, index }
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

**Challenge:** Implementing bidirectional scroll synchronization between textarea (source) and div (preview).

**Key Implementation Details:**

1. **Ref Assignment**: Ensure refs point to scrollable containers, not inner content
   ```typescript
   // ✅ Correct - ref on scrollable container
   <div ref={previewContainerRef} className="overflow-auto">
     <div className="markdown-body">...</div>
   </div>
   
   // ❌ Wrong - ref on inner content
   <div className="overflow-auto">
     <div ref={previewRef} className="markdown-body">...</div>
   </div>
   ```

2. **Prevent Scroll Loop**: Use flag + timeout to prevent infinite recursion
   ```typescript
   const isSyncingScroll = useRef(false)
   
   const handleSourceScroll = useCallback(() => {
     if (!isSyncingScroll.current && previewContainerRef.current) {
       isSyncingScroll.current = true
       
       // Calculate scroll percentage and apply to other side
       const scrollPercentage = textarea.scrollTop / 
         (textarea.scrollHeight - textarea.clientHeight || 1)
       previewContainer.scrollTop = scrollPercentage * 
         (previewContainer.scrollHeight - previewContainer.clientHeight)
       
       // Release lock after short delay
       setTimeout(() => { isSyncingScroll.current = false }, 50)
     }
   }, [viewMode])
   ```

3. **Percentage-based Sync**: Scroll position is synchronized proportionally rather than absolutely, accommodating different content heights.

### Testing Markdown Extensions

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

### Code Quality Checklist

Before committing:

1. **Type Check**: `pnpm tsc --noEmit`
2. **Lint**: `pnpm lint`
3. **Format**: `pnpm format`
4. **Unit Tests**: `pnpm test:run`
5. **Update Documentation**:
   - `README.md` - User-facing features
   - `PLAN.md` - Development progress
   - `AGENTS.md` - Technical knowledge base


### 任务列表 (Checkbox) 实现

**Markdown 语法:**
```markdown
- [ ] 未完成任务
- [x] 已完成任务
* [ ] 支持星号标记
```

**实现要点:**

1. **预处理器 (preprocessTaskLists)**
   - 使用正则 `/^(\s*)([-*])\s+\[([\sxX])\]\s+(.*)$/` 匹配任务列表
   - 将 `[ ]` 或 `[x]` 替换为特殊标记 `[[TASK:index:status]]`
   - 保留后续内容不变，以便 markdown-it 正常解析 Markdown

2. **后处理器 (postprocessTaskLists)**
   - 将 `[[TASK:index:status]]` 替换为 checkbox HTML
   - 处理两种格式:
     - `<li><p>[[TASK:...]]</p></li>` (markdown-it 自动包裹 p 标签)
     - `<li>[[TASK:...]]</li>` (普通情况)
   - 生成带有 `data-task-index` 属性的 checkbox，用于交互

3. **HTML 结构**
   ```html
   <li class="task-list-item" data-task-index="0" data-task-status="unchecked">
     <input type="checkbox" class="task-checkbox" data-task-index="0" data-task-status="unchecked" />
     <span class="task-content">任务文本（支持 <strong>粗体</strong>、<a href="...">链接</a>）</span>
   </li>
   ```

4. **CSS 关键样式**
   - `display: flex` 布局让 checkbox 和文本对齐
   - **重要**: 内容必须包装在 `<span class="task-content">` 中，避免 flex 把子元素分散
   - 自定义 checkbox 样式，支持深色模式

5. **交互实现 (Editor.tsx)**
   - 监听预览区域的点击事件
   - 点击 checkbox 时，根据 `data-task-index` 找到对应的 Markdown 行
   - 切换 `- [ ]` ↔ `- [x]`，更新文档内容
   - 与历史记录系统集成，支持撤销/重做

6. **关键修复：dangerouslySetInnerHTML 状态同步**
   
   **问题**: 使用 `dangerouslySetInnerHTML` 时，浏览器会在 click 事件触发前自动改变 checkbox 的 `checked` 属性，导致状态判断错误。
   
   **解决方案**:
   - 使用 `data-task-status` 属性判断状态，而不是 `checkbox.checked`
   - HTML 更新后，使用 `useEffect` 手动同步 checkbox 的 DOM 状态
   
   ```typescript
   // HTML 更新后同步 checkbox 状态
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

7. **工具栏按钮**
   - 在 Toolbar 添加任务列表按钮（位于无序列表按钮旁边）
   - 使用 `FormatButton` 组件，format 类型为 `'tasklist'`
   - 在 `useTextFormat.ts` 中添加配置：`tasklist: { prefix: '- [ ] ', suffix: '' }`
   - 点击后在当前光标位置插入 `- [ ] `（未勾选的任务列表项）

**注意事项:**
- 任务列表与普通列表混用时，只有任务列表项有 `task-list-item` 类
- 全局 `globalTaskIndex` 用于给每个 checkbox 唯一标识
- 每次渲染前调用 `resetTaskIndex()` 重置计数器
- **重要**: checkbox 和 li 都必须有 `data-task-status` 属性，点击处理时使用 checkbox 上的属性判断状态

---

### 外部链接打开（系统浏览器）

**需求:** 点击 Markdown 中的链接时，使用系统默认浏览器打开，而不是在 VividMark 窗口内打开。

**实现方案:**

1. **依赖安装**
   ```bash
   pnpm add @tauri-apps/plugin-shell
   ```

2. **Rust 后端配置**
   - `src-tauri/Cargo.toml` 添加依赖:
     ```toml
     tauri-plugin-shell = "2"
     ```
   - `src-tauri/src/lib.rs` 初始化插件:
     ```rust
     .plugin(tauri_plugin_shell::init())
     ```
   - `src-tauri/capabilities/default.json` 添加权限:
     ```json
     "permissions": [
       "shell:default"
     ]
     ```

3. **前端实现 (Editor.tsx)**
   ```typescript
   import { open } from '@tauri-apps/plugin-shell'
   
   // 在预览区域点击事件处理中
   const handlePreviewClick = useCallback(async (e: React.MouseEvent) => {
     const target = e.target as HTMLElement
     
     // 检查点击的是否是链接（或链接内的元素）
     const linkElement = target.closest('a[href]') as HTMLAnchorElement | null
     if (linkElement) {
       const href = linkElement.getAttribute('href')
       if (href) {
         // 阻止默认行为（在应用内打开）
         e.preventDefault()
         
         // 使用系统浏览器打开外部链接
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

**关键点:**
- 使用 `target.closest('a[href]')` 捕获点击链接的事件（包括点击链接内的元素）
- **必须**调用 `e.preventDefault()` 阻止默认的导航行为
- 权限配置 `shell:default` 是关键，缺少会导致功能无法工作

---

### GitHub Actions 自动构建与发布

**工作流文件:** `.github/workflows/release.yml`

**功能:**
- 推送 `v*` 标签时自动触发构建
- 支持手动触发
- 多平台并行构建：
  - macOS (Universal Binary - Intel & Apple Silicon)
  - Windows (x64)
  - Linux (x64, deb + AppImage)
- 自动上传到 GitHub Releases

**触发方式:**

1. **标签推送触发:**
   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

2. **手动触发:**
   - 进入 GitHub Actions 页面
   - 选择 "Release" 工作流
   - 点击 "Run workflow"

**工作流配置要点:**

```yaml
jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-22.04, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: dtolnay/rust-toolchain@stable  # 注意：不是 rust-action
      - name: Install dependencies (Ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
      - run: pnpm install --frozen-lockfile
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**构建产物:**

| 平台 | 产物 |
|------|------|
| macOS | `VividMark_*.dmg` |
| Windows | `VividMark_*_x64-setup.exe` |
| Linux | `VividMark_*_amd64.deb` / `.AppImage` |

**常见问题及解决:**

1. **Rust toolchain action 找不到** (`dtolnay/rust-action`)
   - 正确名称是 `dtolnay/rust-toolchain@stable`

2. **TypeScript 编译错误** (`TS6133: 'match' is declared but its value is never read`)
   - CI 环境使用严格模式，未使用变量需要加下划线前缀 `_match`

3. **macOS "应用已损坏" 提示**
   - 原因：没有代码签名，被 Gatekeeper 拦截
   - 解决：
     ```bash
     # 移除隔离属性
     xattr -rd com.apple.quarantine /Applications/VividMark.app
     ```
   - 或在 系统设置 → 隐私与安全性 → 仍要打开

**必需的 Secrets:**
- `GITHUB_TOKEN`: 自动生成，无需配置

**可选 Secrets (用于代码签名):**
- `APPLE_CERTIFICATE`: Apple 开发者证书 (Base64)
- `APPLE_CERTIFICATE_PASSWORD`: 证书密码
- `APPLE_SIGNING_IDENTITY`: 签名身份
- `APPLE_ID`: Apple ID (用于公证)
- `APPLE_PASSWORD`: Apple ID 应用专用密码

**注意事项:**
- macOS 未签名应用需要通过命令行或系统设置绕过 Gatekeeper
- Windows 未签名应用会显示 SmartScreen 警告
- Linux 无需签名，但 `.deb` 包需要管理员权限安装

---

### GitHub Release 发布流程

**版本号管理:**
- `package.json` - 前端版本号
- `src-tauri/tauri.conf.json` - Tauri 应用版本号
- `src-tauri/Cargo.toml` - Rust crate 版本号

三者应保持同步。

**构建并发布 Release:**

```bash
# 1. 确保版本号已更新
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to X.Y.Z"

# 2. 创建并推送 tag
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z

# 3. 构建 release（macOS 示例）
pnpm tauri build

# 4. 创建 GitHub Release 并上传构建产物
gh release create vX.Y.Z \
  --title "VividMark vX.Y.Z" \
  --notes "Release notes here" \
  --draft=false \
  --prerelease=false \
  "src-tauri/target/release/bundle/dmg/VividMark_X.Y.Z_aarch64.dmg"
```

**构建产物位置:**
| 平台 | 产物类型 | 路径 |
|------|---------|------|
| macOS | .app bundle | `src-tauri/target/release/bundle/macos/VividMark.app` |
| macOS | .dmg 安装包 | `src-tauri/target/release/bundle/dmg/VividMark_X.Y.Z_aarch64.dmg` |

---

### 文档国际化 (I18n)

**README 双版本结构:**
```
README.md          # 英文版（主文件）
README.zh-CN.md    # 简体中文版
```

**README 语言切换链接格式:**
```markdown
<!-- README.md 顶部 -->
**English | [简体中文](README.zh-CN.md)**

<!-- README.zh-CN.md 顶部 -->
**[English](README.md) | 简体中文**
```

**GitHub Pages 双版本结构:**
```
docs/
├── index.html          # 英文版首页
├── index.zh-CN.html    # 简体中文版首页
├── css/style.css       # 共享样式（含语言切换器样式）
└── images/             # 共享资源
```

**语言切换器 HTML:**
```html
<span class="lang-switch">
  <a href="index.html" class="active">EN</a> | <a href="index.zh-CN.html">中</a>
</span>
```

**CSS 样式:**
```css
.lang-switch {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin-left: 8px;
  padding-left: 16px;
  border-left: 1px solid var(--color-border);
}

.lang-switch a {
  color: var(--color-text-secondary);
  text-decoration: none;
  padding: 2px 4px;
}

.lang-switch a:hover {
  color: var(--color-text);
}

.lang-switch a.active {
  color: var(--color-primary);
  font-weight: 600;
}
```

**同步更新清单:**
当更新文档时，需同时修改以下对应文件：
- `README.md` ↔ `README.zh-CN.md`
- `docs/index.html` ↔ `docs/index.zh-CN.html`

---

### GitHub Pages Deployment

**Setup for Static Site:**

1. **Create `docs/` directory** at repository root with static HTML files
2. **GitHub Actions Workflow** (`.github/workflows/pages.yml`):
   ```yaml
   name: Deploy to GitHub Pages
   
   on:
     push:
       branches: [main]
     workflow_dispatch:
   
   permissions:
     contents: read
     pages: write
     id-token: write
   
   jobs:
     deploy:
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       runs-on: ubuntu-latest
       steps:
         - name: Checkout
           uses: actions/checkout@v4
         
         - name: Setup Pages
           uses: actions/configure-pages@v5
         
         - name: Upload artifact
           uses: actions/upload-pages-artifact@v3
           with:
             path: './docs'
         
         - name: Deploy to GitHub Pages
           id: deployment
           uses: actions/deploy-pages@v4
   ```

3. **Repository Settings:**
   - Go to **Settings → Pages**
   - Set **Source** to **GitHub Actions**

**Common Issues:**

- **"Setup Pages" step fails**: Ensure Pages source is set to "GitHub Actions" in repository settings, not "Deploy from branch"
- **Workflow not triggering**: Avoid using `paths` filter initially; can add after confirming basic setup works
- **404 errors**: Wait 1-2 minutes after deployment completion for CDN propagation

**Best Practices:**

- Keep static assets (CSS, images) in `docs/` directory
- Use relative paths for internal links
- Test locally by opening `docs/index.html` in browser

---

## Git 仓库管理

### 不应提交到 Git 的文件类型

| 类别 | 示例 | 原因 |
|------|------|------|
| **生成文件** | `coverage/`, `dist/`, `*.log` | 每次构建都会重新生成 |
| **测试报告** | `test-results/`, `playwright-report/` | CI 生成，无需版本控制 |
| **依赖目录** | `node_modules/`, `src-tauri/target/` | 通过 package 管理器安装 |
| **本地配置** | `.claude/`, `.idea/`, `.vscode/` | 个人开发环境配置 |
| **敏感信息** | `.env`, `*.token`, `*.key` | 安全风险 |
| **系统文件** | `.DS_Store`, `Thumbs.db` | 操作系统生成 |

### 检查已提交的不当文件

```bash
# 查找不应提交的文件
git ls-files | grep -E "(coverage|test-results|\.claude|node_modules|dist)"

# 查看文件大小（大文件检测）
git ls-files | xargs -I{} ls -lh {} | sort -k5 -hr | head -20
```

### 清理已提交的文件

```bash
# 1. 先添加到 .gitignore
echo "coverage/" >> .gitignore
echo "test-results/" >> .gitignore

# 2. 从 git 移除（保留本地文件）
git rm -r --cached coverage test-results

# 3. 提交更改
git add .gitignore
git commit -m "chore: 移除生成文件"
```

### 项目 .gitignore 配置

```gitignore
# Dependencies
node_modules

# Build output
dist
dist-ssr

# Logs
*.log

# Editor
.vscode/*
.idea
.DS_Store
*.sw?

# Tauri
src-tauri/target

# Testing
coverage
test-results
playwright-report

# Local config
.claude/
*.local

# Secrets
.env
.env.local
```

---

## Future Plans / 待办任务

### Typst 离线支持 (Pending)

> **详细任务计划**: [`docs/typst-offline-plan.md`](./docs/typst-offline-plan.md)（含 9 个 Phase 的完整清单）

**状态**: ⏸️ 待当前重要任务完成后启动  
**创建时间**: 2026-03-02  
**预计工期**: 2-3 周（完整功能）/ 1 周（MVP）

#### 需求背景
为 VividMark 添加 Typst 渲染支持，确保用户在离线/弱网环境下也能正常使用。

#### 技术方案
- 使用 `@myriaddreamin/typst.ts` 提供 JavaScript API
- WASM 文件本地打包（compiler + renderer，约 5MB）
- 字体文件本地打包（最小集约 1MB，含中文字体约 15-20MB）
- Tauri 资源目录托管，零外部 CDN 依赖

#### 任务进展追踪

| Phase | 任务 | 状态 | 产出物 |
|-------|------|------|--------|
| P1 | 调研与准备 | ⏸️ 未开始 | 技术选型、字体清单 |
| P2 | 资源准备 | ⏸️ 未开始 | WASM/字体文件、下载脚本 |
| P3 | 前端集成 | ⏸️ 未开始 | `init.ts`、WASM 加载器 |
| P4 | 解析器集成 | ⏸️ 未开始 | `parser.ts` Typst 支持 |
| P5 | UI/UX | ⏸️ 未开始 | 样式、Loading 组件 |
| P6 | 系统字体支持 | ⏸️ 未开始 | Rust 字体扫描 API |
| P7 | 中文支持 | ⏸️ 未开始 | Noto CJK 或系统字体方案 |
| P8 | 测试与优化 | ⏸️ 未开始 | 单元测试、离线验证 |
| P9 | 文档与发布 | ⏸️ 未开始 | README、CHANGELOG |

**当前阻塞**: 等待当前重要任务完成  
**下一步行动**: 启动 Phase 1 调研

#### 实现要点
```typescript
// WASM 本地加载配置
$typst.setCompilerInitOptions({
  getModule: () => '/typst/typst_ts_web_compiler_bg.wasm',
  getFontAssets: () => ['/typst/fonts/']
})

// 代码块渲染
if (lang === 'typst') {
  const svg = await $typst.svg({ mainContent: code })
  return `<div class="typst-render">${svg}</div>`
}
```

#### 资源清单
| 资源 | 大小 | 许可 |
|------|------|------|
| typst_ts_web_compiler_bg.wasm | ~3MB | Apache-2.0 |
| typst_ts_renderer_bg.wasm | ~2MB | Apache-2.0 |
| New Computer Modern (字体) | ~750KB | OFL 1.1 |
| Libertinus (字体) | ~300KB | OFL 1.1 |
| Noto Sans CJK (可选中文) | ~15MB | OFL 1.1 |

#### 待决策事项
| # | 问题 | 建议方案 |
|---|------|---------|
| 1 | 中文支持策略 | 先使用系统字体，后续可选打包 |
| 2 | WASM 加载时机 | 懒加载（首次使用 Typst 时） |
| 3 | 字体回退 | 宽松回退（用户体验优先） |
| 4 | 缓存策略 | 从内存缓存开始 |

---

### 最佳实践

1. **项目初始化时就配置好 `.gitignore`**
2. **定期检查** `git status` 确保没有遗漏
3. **提交前审查** `git diff --cached --name-only`
4. **已提交的大文件** 使用 `git filter-branch` 或 BFG Repo-Cleaner 清理历史
5. **敏感信息泄露** 立即轮换密钥，清理历史，启用 secret scanning

---

### 侧边栏文件树实现

**文件结构:**
```
src/
├── components/FileTree/
│   ├── FileTree.tsx        # 文件树主组件
│   ├── FileTreeItem.tsx    # 单个文件/文件夹项
│   └── index.ts
├── hooks/useResizable.ts   # 可拖拽调整宽度 hook
└── lib/fileTreeUtils.ts    # 文件树工具函数

src-tauri/src/lib.rs        # Rust 后端 read_directory 命令
```

**关键技术点:**

1. **Rust 后端类型映射**
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct FileTreeItem {
       pub name: String,
       pub path: String,
       #[serde(rename = "isDirectory")]  // 重要：驼峰命名映射
       pub is_directory: bool,
       pub children: Option<Vec<FileTreeItem>>,
   }
   ```

2. **递归展开所有子目录**
   ```typescript
   const setAllExpanded = (items: FileTreeItem[], expanded: boolean): FileTreeItem[] => {
     return items.map((item) => ({
       ...item,
       isExpanded: item.isDirectory ? expanded : undefined,
       children: item.children ? setAllExpanded(item.children, expanded) : undefined,
     }))
   }
   ```

3. **Markdown 文件过滤**
   ```typescript
   export function filterMarkdownFiles(items: FileTreeItem[]): FileTreeItem[] {
     return items
       .filter((item) => {
         if (item.isDirectory) return true
         return item.name.endsWith('.md') || 
                item.name.endsWith('.markdown') || 
                item.name.endsWith('.txt')
       })
       .map((item) => ({
         ...item,
         children: item.children ? filterMarkdownFiles(item.children) : undefined,
       }))
   }
   ```

4. **可拖拽调整宽度 Hook**
   ```typescript
   export function useResizable({
     initialWidth,
     minWidth = 200,
     maxWidth = 500,
     onResize,
   }: UseResizableOptions)
   ```

**界面元素:**
- 标签页切换（大纲 / 文件树）
- 文件夹标题栏（显示文件夹名 + 关闭按钮）
- 文件项（展开/折叠指示器 + 文件图标 + 文件名）
- 拖拽 handle（右侧边缘，hover 显示）

**默认行为:**
- 默认只显示 Markdown/txt 文件和文件夹（`showMarkdownOnly = true`）
- 所有文件夹默认展开
- 点击文件夹切换展开/折叠
- 点击文件打开（有未保存更改时确认）
- 当前打开的文件高亮显示

---

### 最佳实践

1. **项目初始化时就配置好 `.gitignore`**
2. **定期检查** `git status` 确保没有遗漏
3. **提交前审查** `git diff --cached --name-only`
4. **已提交的大文件** 使用 `git filter-branch` 或 BFG Repo-Cleaner 清理历史
5. **敏感信息泄露** 立即轮换密钥，清理历史，启用 secret scanning

---

## WYSIWYG 模式架构

> 2026-03-05 创建  
> 状态：Phase 1 已完成，Phase 2 待开始

### 设计方案

**选择方案**：方案 A（四模式共存，WYSIWYG 作为默认模式）

```
[WYSIWYG] [Source] [Preview] [Split]
   ↑ 默认选中
```

### 类型定义

```typescript
// editorStore.ts
viewMode: 'wysiwyg' | 'source' | 'preview' | 'split'

// 默认模式
viewMode: 'wysiwyg'  // 从 'source' 改为 'wysiwyg'
```

### 文件变更记录

| 文件 | 变更内容 |
|------|----------|
| `src/stores/editorStore.ts` | 扩展 ViewMode 类型，修改默认值，持久化 viewMode |
| `src/i18n/locales/en.json` | 添加 `toolbar.viewMode.wysiwyg`: "WYSIWYG" |
| `src/i18n/locales/zh-CN.json` | 添加 `toolbar.viewMode.wysiwyg`: "编辑" |
| `src/components/Toolbar/Toolbar.tsx` | 添加 WYSIWYG 模式切换按钮 |
| `src/components/Editor/Editor.tsx` | 添加 WYSIWYG 模式渲染分支（临时占位） |

### 实现阶段

#### Phase 1 ✅ 已完成（2026-03-05）
- Store 类型扩展与默认值变更
- 模式切换 UI（四模式按钮）
- i18n 翻译更新
- 测试覆盖

#### Phase 2 ⏳ 待开始
- Markdown → HTML 渲染（带位置映射）
- HTML → Markdown 反向转换（turndown）
- 基础编辑同步

#### Phase 3-7 📋 规划中
- 块级元素支持（列表、代码块、表格）
- 行内样式与快捷键
- 高级功能（图片、Admonitions）
- 优化与测试

### 技术文档

- **调研文档**: `docs/wysiwyg-research.md`
- **实现计划**: `docs/wysiwyg-implementation-plan.md`

### 待决策事项

| # | 问题 | 当前状态 |
|---|------|----------|
| 1 | 工具栏按钮在 WYSIWYG 模式下的行为 | 待讨论 |
| 2 | 快捷键设计（`Cmd+/` 切换） | 待实现 |
| 3 | 是否使用 ProseMirror 替代 contenteditable | 待调研 |

