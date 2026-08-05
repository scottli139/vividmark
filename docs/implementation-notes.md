# VividMark 实现细节知识库

> 本文档收录从 `AGENTS.md` 迁出的详细实现笔记、踩坑记录与发布运维流程。
> 任务进度请看 [`PLAN.md`](../PLAN.md)；agent 精简指南请看 [`AGENTS.md`](../AGENTS.md)。

## 目录

- [已知问题](#已知问题)
- [Markdown 扩展实现](#markdown-扩展实现)
- [编辑器架构](#编辑器架构)
- [侧边栏文件树](#侧边栏文件树实现)
- [工具栏布局](#工具栏布局-2026-03-06)
- [Windows 路径处理](#windows-路径处理)
- [Export PDF 详解](#export-pdf-详解)
- [Logging](#logging)
- [CI/CD 与发布](#cicd-与发布)
- [Git 仓库管理](#git-仓库管理)
- [Typst 离线支持](#typst-离线支持)

---

## 已知问题

### 代码块等宽字体（中文对齐）

> 当前状态：中英文混排的 ASCII 艺术图无法对齐

**问题描述：**
在 Markdown 代码块中，如果混用中英文（如 ASCII 流程图），中文字符和 ASCII 字符无法正确对齐。

**原因分析：**

- 中文字符（全角）宽度应为 ASCII 字符（半角）的 2 倍
- 但在 WebView 中渲染时，实际宽度比例无法严格保持 2:1
- 尝试多种等宽字体（Menlo、Monaco、Courier New 等）均无法解决
- 这是 WebKit/WebView 的底层渲染限制

**尝试过的解决方案：**

1. ✅ 设置多种系统等宽字体
2. ✅ 使用 `font-variant-ligatures: none` 禁用连字
3. ✅ 强制所有子元素继承等宽字体
4. ✅ 添加 `-webkit-font-feature-settings` 前缀
5. ❌ 均无效

**建议替代方案：**

- 使用 **Mermaid** 语法绘制图表（VividMark 已支持）
- 使用 **PlantUML** 绘制专业图表
- 避免在 ASCII 图中混用中英文，使用纯 ASCII 字符

### PDF 导出默认文件名

> 当前状态：打印对话框默认文件名为 `vividmark.pdf`，期望使用文档名称如 `document.pdf`

**问题分析：**

- macOS 系统打印对话框默认使用应用 bundle 名称作为 PDF 默认文件名
- 尝试 `document.title` 修改无效
- 尝试 `NSPrintInfo.setJobName:` 方法导致崩溃
- 这是 macOS 系统的标准行为

**可能的解决方案：**

1. **方案 A**：使用 `tauri-plugin-dialog` 显示保存对话框，让用户指定文件名和位置
   - 优点：用户体验好，直接指定文件名
   - 缺点：需要额外实现 HTML → PDF 的转换（可能需要 `wkhtmltopdf` 或类似工具）
2. **方案 B**：接受当前限制，在 UI 中提示用户手动修改文件名
   - 优点：无需额外开发
   - 缺点：用户体验不佳

**参考实现：**

- 文件：`src-tauri/src/lib.rs` 中的 `print_pdf` 函数
- 前端：`src/lib/exportPdf.ts` 中的 `printToPdf` 函数

**优先级：** P2（低优先级，当前方案可用，只是体验不够理想）

---

## Markdown 扩展实现

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

### 任务列表 (Checkbox)

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
     <input
       type="checkbox"
       class="task-checkbox"
       data-task-index="0"
       data-task-status="unchecked"
     />
     <span class="task-content"
       >任务文本（支持 <strong>粗体</strong>、<a href="...">链接</a>）</span
     >
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

### Markdown 扩展测试模式

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

## 编辑器架构

### WYSIWYG 模式架构

> 2026-03-05 创建  
> 状态：Phase 1 已完成，Phase 2 待开始

**设计方案**：方案 A（四模式共存，WYSIWYG 作为默认模式）

```
[WYSIWYG] [Source] [Preview] [Split]
   ↑ 默认选中
```

**类型定义:**

```typescript
// editorStore.ts
viewMode: 'wysiwyg' | 'source' | 'preview' | 'split'

// 默认模式
viewMode: 'wysiwyg' // 从 'source' 改为 'wysiwyg'
```

**Phase 1 文件变更记录:**

| 文件                                 | 变更内容                                        |
| ------------------------------------ | ----------------------------------------------- |
| `src/stores/editorStore.ts`          | 扩展 ViewMode 类型，修改默认值，持久化 viewMode |
| `src/i18n/locales/en.json`           | 添加 `toolbar.viewMode.wysiwyg`: "WYSIWYG"      |
| `src/i18n/locales/zh-CN.json`        | 添加 `toolbar.viewMode.wysiwyg`: "编辑"         |
| `src/components/Toolbar/Toolbar.tsx` | 添加 WYSIWYG 模式切换按钮                       |
| `src/components/Editor/Editor.tsx`   | 添加 WYSIWYG 模式渲染分支（临时占位）           |

**实现阶段:**

- Phase 1 ✅（2026-03-05）：Store 类型扩展与默认值变更、模式切换 UI、i18n、测试覆盖
- Phase 2 ⏳：Markdown → HTML 渲染（带位置映射）、HTML → Markdown 反向转换（turndown）、基础编辑同步
- Phase 3-7 📋：块级元素支持（列表、代码块、表格）、行内样式与快捷键、高级功能（图片、Admonitions）、优化与测试

**技术文档:**

- 调研: [`wysiwyg-research.md`](./wysiwyg-research.md)
- 实现计划: [`wysiwyg-implementation-plan.md`](./wysiwyg-implementation-plan.md)

**待决策事项:**

| #   | 问题                                      | 当前状态 |
| --- | ----------------------------------------- | -------- |
| 1   | 工具栏按钮在 WYSIWYG 模式下的行为         | 待讨论   |
| 2   | 快捷键设计（`Cmd+/` 切换）                | 待实现   |
| 3   | 是否使用 ProseMirror 替代 contenteditable | 待调研   |

### Outline Navigation (大纲视图点击跳转)

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

   | Mode    | Navigation Method         | Implementation                             |
   | ------- | ------------------------- | ------------------------------------------ |
   | Source  | Scroll textarea + cursor  | `scrollToPosition(textarea, charIndex)`    |
   | Split   | Scroll textarea + cursor  | `scrollToPosition(textarea, charIndex)`    |
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

**Challenge:** Bidirectional scroll synchronization between textarea (source) and div (preview).

1. **Ref Assignment**: Ensure refs point to scrollable containers, not inner content（同上）

2. **Prevent Scroll Loop**: Use flag + timeout to prevent infinite recursion

   ```typescript
   const isSyncingScroll = useRef(false)

   const handleSourceScroll = useCallback(() => {
     if (!isSyncingScroll.current && previewContainerRef.current) {
       isSyncingScroll.current = true

       // Calculate scroll percentage and apply to other side
       const scrollPercentage =
         textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1)
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

### 缩放功能 (Zoom)

支持编辑器内容区域的缩放（50% - 200%），步进 10%，状态持久化。

**Store 状态** (`editorStore.ts`):

```typescript
zoomLevel: number  // 默认 100
setZoomLevel: (level: number) => void
zoomIn: () => void   // +10%，上限 200%
zoomOut: () => void  // -10%，下限 50%
zoomReset: () => void // 重置为 100%
```

**应用缩放** (`Editor.tsx`)，Source / Split / Preview 模式都支持:

```typescript
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

### 外部链接打开（系统浏览器）

**需求:** 点击 Markdown 中的链接时，使用系统默认浏览器打开，而不是在 VividMark 窗口内打开。

**实现方案:**

1. **依赖安装**

   ```bash
   pnpm add @tauri-apps/plugin-shell
   ```

2. **Rust 后端配置**
   - `src-tauri/Cargo.toml` 添加 `tauri-plugin-shell = "2"`
   - `src-tauri/src/lib.rs` 初始化: `.plugin(tauri_plugin_shell::init())`
   - `src-tauri/capabilities/default.json` 添加权限 `"shell:default"`

3. **前端实现 (Editor.tsx)**

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

**关键点:**

- 使用 `target.closest('a[href]')` 捕获点击链接的事件（包括点击链接内的元素）
- **必须**调用 `e.preventDefault()` 阻止默认的导航行为
- 权限配置 `shell:default` 是关键，缺少会导致功能无法工作

---

## 侧边栏文件树实现

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

## 工具栏布局 (2026-03-06)

**优化目标：** 解决工具栏按钮过多、布局拥挤的问题，将功能合理分组。

**布局调整：**

- **左侧**：文件操作（新建、打开、保存）+ 撤销/重做
- **中间**：核心格式化工具 + 视图切换
- **右侧**：缩放控制 + 语言/主题设置

**功能分组:**

| 按钮组     | 包含功能                                                 |
| ---------- | -------------------------------------------------------- |
| 基础格式化 | 粗体、斜体                                               |
| 标题下拉   | H1/H2/H3 合并为一个下拉菜单                              |
| 列表       | 无序列表                                                 |
| 插入菜单   | 图片、表格、代码块（下拉）                               |
| 更多格式   | 删除线、行内代码、链接、有序列表、任务列表、引用（下拉） |

**新增组件:**

- `HeadingDropdown.tsx` — 标题级别选择下拉，Props: `onSelect: (level: 1 | 2 | 3) => void`
- `InsertMenu.tsx` — 插入功能下拉，Props: `onImage, onTable, onCodeBlock`
- `FormatMenu.tsx` — 更多格式化选项下拉，Props: `onFormat: (format: FormatType) => void`

**窗口标题:**

- 文件名从工具栏移除，改为显示在窗口标题栏
- 格式：`文件名 ● - VividMark`（有未保存更改时显示 ●）
- 使用 `@tauri-apps/api/window` 的 `setTitle` API

**语言选择器:**

- 原使用 emoji 国旗（🇺🇸 🇨🇳）在 Windows 上可能显示异常，改为文字标签 `EN` / `中`
- 数据结构增加 `label` 字段：
  ```typescript
  { code: 'en', name: 'English', flag: '🇺🇸', label: 'EN' },
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳', label: '中' }
  ```

**视图切换按钮:** 四个模式按钮为紧凑的文字按钮，使用 bg 色区分激活状态，顺序：WYSIWYG | Source | Split | Preview

---

## Windows 路径处理

**问题背景:**
Windows 系统使用 `\` 作为路径分隔符，而 Unix/macOS 使用 `/`。处理跨平台文件路径时需要统一处理两种分隔符，否则会导致路径解析错误。

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

## Export PDF 详解

### 工作原理

由于 Tauri 的安全限制，无法直接静默生成 PDF 文件。导出 PDF 的工作流程如下：

1. **用户点击导出按钮** - 工具栏上的打印机图标或 `Cmd/Ctrl + P` 快捷键
2. **前端发送 HTML 内容** - Editor 组件通过 `editor-request-html` 事件将渲染后的 HTML 发送到 exportPdf 模块
3. **Rust 后端创建临时 HTML 文件** - 添加打印友好的 CSS 样式
4. **系统浏览器打开 HTML** - 使用 `tauri-plugin-opener` 打开系统默认浏览器
5. **用户手动打印为 PDF** - 在浏览器中使用 "打印为 PDF" 功能保存

### 实现文件

| 文件                                 | 说明                                 |
| ------------------------------------ | ------------------------------------ |
| `src-tauri/src/lib.rs`               | Rust `export_pdf` / `print_pdf` 命令 |
| `src/lib/exportPdf.ts`               | 前端导出工具函数                     |
| `src/components/Toolbar/Toolbar.tsx` | 导出按钮                             |
| `src/components/Editor/Editor.tsx`   | 监听导出事件                         |

### 依赖与权限

**Rust (Cargo.toml):**

```toml
tauri-plugin-opener = "2"
```

**Capabilities (`src-tauri/capabilities/default.json`):**

```json
"opener:default"
```

### CSS 打印样式

临时 HTML 文件包含针对打印优化的 CSS：

- 字体：系统默认无衬线字体栈
- 标题：层级缩进和底部边框
- 代码：灰色背景和等宽字体
- 表格：边框和斑马纹
- 引用：左侧边框
- 图片：最大宽度 100%

### 使用方法

```typescript
import { exportToPdf, exportCurrentDocument } from './lib/exportPdf'

// 导出指定 HTML 内容
await exportToPdf({
  htmlContent: '<h1>Hello World</h1>',
  title: 'My Document',
})

// 导出当前文档（自动使用文件名作为标题）
await exportCurrentDocument(renderedHtml)
```

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

## CI/CD 与发布

### CI 工作流 (test.yml)

1. **Lint job**: ESLint + Prettier check
2. **Typecheck job**: TypeScript compilation check
3. **Unit Tests job**: Vitest with coverage reporting to Codecov
4. **E2E Tests job**: Currently disabled (requires Tauri setup)

### GitHub Actions 自动构建与发布 (release.yml)

**功能:**

- 推送 `v*` 标签时自动触发构建，支持手动触发
- 多平台并行构建：macOS (Universal)、Windows (x64)、Linux (x64, deb + AppImage)
- 自动上传到 GitHub Releases

**触发方式:**

```bash
git tag v0.1.1
git push origin v0.1.1
```

**工作流配置要点:**

- Rust toolchain 使用 `dtolnay/rust-toolchain@stable`（注意：不是 `rust-action`）
- Ubuntu 需要安装: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
- `pnpm install --frozen-lockfile`
- 构建使用 `tauri-apps/tauri-action@v0`，Secrets 只需自动生成的 `GITHUB_TOKEN`

**常见问题及解决:**

1. **TypeScript 编译错误** (`TS6133: 'match' is declared but its value is never read`)
   - CI 环境使用严格模式，未使用变量需要加下划线前缀 `_match`

2. **macOS "应用已损坏" 提示**
   - 原因：没有代码签名，被 Gatekeeper 拦截
   - 解决：`xattr -rd com.apple.quarantine /Applications/VividMark.app`，或在 系统设置 → 隐私与安全性 → 仍要打开

**可选 Secrets (用于代码签名):**
`APPLE_CERTIFICATE` / `APPLE_CERTIFICATE_PASSWORD` / `APPLE_SIGNING_IDENTITY` / `APPLE_ID` / `APPLE_PASSWORD`

**注意事项:**

- Windows 未签名应用会显示 SmartScreen 警告
- Linux 无需签名，但 `.deb` 包需要管理员权限安装

### GitHub Release 发布流程

**版本号管理**（三者应保持同步）:

- `package.json` - 前端版本号
- `src-tauri/tauri.conf.json` - Tauri 应用版本号
- `src-tauri/Cargo.toml` - Rust crate 版本号

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

### 文档国际化（README / GitHub Pages）

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
├── css/style.css       # 共享样式（含 .lang-switch 语言切换器样式）
└── images/             # 共享资源
```

**同步更新清单（必须成对修改）:**

- `README.md` ↔ `README.zh-CN.md`
- `docs/index.html` ↔ `docs/index.zh-CN.html`

### GitHub Pages Deployment

- 静态文件放在 `docs/` 目录，工作流为 `.github/workflows/pages.yml`
- 使用 `actions/configure-pages@v5` + `actions/upload-pages-artifact@v3` (path: `./docs`) + `actions/deploy-pages@v4`
- 仓库 Settings → Pages → Source 必须设为 **GitHub Actions**（不是 "Deploy from branch"），否则 Setup Pages 步骤失败
- 部署完成后 404 可能是 CDN 传播延迟，等待 1-2 分钟

---

## Git 仓库管理

### 不应提交到 Git 的文件类型

| 类别         | 示例                                  | 原因                    |
| ------------ | ------------------------------------- | ----------------------- |
| **生成文件** | `coverage/`, `dist/`, `*.log`         | 每次构建都会重新生成    |
| **测试报告** | `test-results/`, `playwright-report/` | CI 生成，无需版本控制   |
| **依赖目录** | `node_modules/`, `src-tauri/target/`  | 通过 package 管理器安装 |
| **本地配置** | `.claude/`, `.idea/`, `.vscode/`      | 个人开发环境配置        |
| **敏感信息** | `.env`, `*.token`, `*.key`            | 安全风险                |
| **系统文件** | `.DS_Store`, `Thumbs.db`              | 操作系统生成            |

### 检查与清理

```bash
# 查找不应提交的文件
git ls-files | grep -E "(coverage|test-results|\.claude|node_modules|dist)"

# 清理：先加入 .gitignore，再从 git 移除（保留本地文件）
git rm -r --cached coverage test-results
git add .gitignore
git commit -m "chore: 移除生成文件"
```

### 最佳实践

1. **项目初始化时就配置好 `.gitignore`**
2. **定期检查** `git status` 确保没有遗漏
3. **提交前审查** `git diff --cached --name-only`
4. **已提交的大文件** 使用 `git filter-branch` 或 BFG Repo-Cleaner 清理历史
5. **敏感信息泄露** 立即轮换密钥，清理历史，启用 secret scanning

---

## Typst 离线支持

> **详细任务计划**: [`typst-offline-plan.md`](./typst-offline-plan.md)（含 9 个 Phase 的完整清单）

**状态**: ⏸️ 待当前重要任务完成后启动（创建于 2026-03-02）
**预计工期**: 2-3 周（完整功能）/ 1 周（MVP）

**需求背景：** 为 VividMark 添加 Typst 渲染支持，确保离线/弱网环境下可用。

**技术方案:**

- 使用 `@myriaddreamin/typst.ts` 提供 JavaScript API
- WASM 文件本地打包（compiler + renderer，约 5MB）
- 字体文件本地打包（最小集约 1MB，含中文字体约 15-20MB）
- Tauri 资源目录托管，零外部 CDN 依赖

**实现要点:**

```typescript
// WASM 本地加载配置
$typst.setCompilerInitOptions({
  getModule: () => '/typst/typst_ts_web_compiler_bg.wasm',
  getFontAssets: () => ['/typst/fonts/'],
})

// 代码块渲染
if (lang === 'typst') {
  const svg = await $typst.svg({ mainContent: code })
  return `<div class="typst-render">${svg}</div>`
}
```

**待决策事项:**

| #   | 问题          | 建议方案                     |
| --- | ------------- | ---------------------------- |
| 1   | 中文支持策略  | 先使用系统字体，后续可选打包 |
| 2   | WASM 加载时机 | 懒加载（首次使用 Typst 时）  |
| 3   | 字体回退      | 宽松回退（用户体验优先）     |
| 4   | 缓存策略      | 从内存缓存开始               |

---

## 2026-08-04 CodeMirror 6 编辑器地基（UX 改进 P0/P1）

> 背景与完整方案：`docs/ux-improvement-plan.md`；任务看板：PLAN.md「Phase 13」。

### 架构要点

- **编辑内核**：Source/Split 的 textarea 已全部替换为 CodeMirror 6，封装在 `src/components/Editor/CodeMirrorEditor.tsx`。WYSIWYG 占位页未动（Editor.tsx wysiwyg 分支）。
- **格式化逻辑是纯函数**：`src/lib/markdownEditing.ts`（`formatTransaction` / `insertTextAtCursor`），接收 EditorState 返回 TransactionSpec；工具栏 `editor-format` 事件与快捷键（Mod-B/I/K/1/2/3，`Prec.highest` keymap）共用，可脱离 DOM 单测。
- **store ↔ CM 同步防回环**：updateListener 写 store 前比较 `value !== store.content`；store → CM 全量替换前同样比较。以 `filePath` 为 key 重建视图，打开新文件自然重置 CM history。
- **撤销**：CM history（按操作分组、恢复选区）取代原 500ms 全文快照 HistoryManager（`useHistory`/`useTextFormat`/`historyManager` 已删除）。`undoDepth`/`redoDepth` 写入 store 驱动工具栏 disabled 态。
- **智能输入**：`markdownKeymap`（回车延续列表/任务/引用、空项退出）、`indentWithTab`、`closeBrackets`。
- **查找替换**：`@codemirror/search`（`search({ top: true })`），面板亮/暗样式补在 globals.css 末尾。
- **图片粘贴/拖拽**：`domEventHandlers` paste/drop → `imageUtils.createImageMarkdownFromFile`（已保存文件复制到 `assets/` 用相对路径，未保存回退 base64）；drop 用 `posAtCoords` 定位插入点。
- **预览防抖**：渲染 120ms（Editor.tsx）、大纲/字数 200ms（`useDebouncedValue` + `src/lib/textStats.ts` 公共算法，Sidebar 与状态栏共用）。
- **状态栏**：`src/components/StatusBar/StatusBar.tsx`；光标行/列经 store 非持久化字段 `cursorLine/cursorCol` 上报。
- **组件常驻挂载**：CodeMirrorEditor 在 preview/wysiwyg 模式下仅 `hidden`，保证撤销历史与工具栏事件跨模式可用。

### 踩坑记录

- **jsdom 跑 CM6 需要 polyfill**：`Range.prototype.getClientRects/getBoundingClientRect`、`scrollIntoView` 等，见 `src/test/setup.ts`。
- **E2E 选择器**：textarea → `.cm-content`；读编辑器内容用 `innerText()` + `expect.poll`（CM 不是 form control，没有 value）。
- **zoom 实现变化**：从 textarea 的 CSS `zoom` 改为字号缩放（14px × zoomLevel/100），内边距不再随缩放变化。
- **遗留**：`e2e/drag-drop.spec.ts` 有 2 个用例依赖 Tauri 窗口级拖拽事件/原生文件对话框，纯浏览器 E2E 无法通过（改造前即失败，与 CM 无关）；预览区点击 checkbox 后 CM 光标移到文末（可接受）；OS 级图片拖入在 Tauri 运行时未实测。

---

## 2026-08-04 WYSIWYG 落地（Milkdown，UX 改进 P2）

### 架构要点

- **内核**：WYSIWYG 模式由 Milkdown v7（ProseMirror）实现，headless 用法（无 `@milkdown/react`，nodeview 全部纯 DOM），组件 `src/components/Editor/WysiwygEditor.tsx`，插件集合 `wysiwygPlugins.ts`。**`@milkdown/kit` 根导出为空，必须子路径导入**（`@milkdown/kit/core`、`/preset/gfm`、`/utils`、`/prose/*`）。
- **同步模型**：markdown 源码是单一事实来源。编辑 → `listener.markdownUpdated` 序列化回 store（200ms 防抖、值相等跳过、仅 wysiwyg 激活时回写）；外部变更 → `replaceAll(content, flush=true)` 重建 EditorState（不产生 transaction，天然不触发回写——**初始化脏标记守卫依赖这一点**，有测试锁定：打开文件/切换模式不标 dirty）。编辑器以 `filePath` 为 key 重建实例。
- **viewMode 分流**：CM 与 Milkdown 都常驻挂载（非激活 hidden）。两侧的事件 handler（`editor-format`/`editor-insert`/`editor-undo`/`editor-redo`）与 `canUndo/canRedo` 写入各自按 `viewMode` 门控——CM 侧门控不可少：wysiwyg 打字时 store→CM 同步会触发 CM listener，不门控会覆写 Milkdown 上报的撤销深度。
- **markdown 往返无损**：不认识的语法降级保留（admonition→段落原文、plantuml→代码块），二次往返不动点有测试锁定；首次进入会一次性规范化（`-`→`*`、裸 URL→`<url>` 等，语义等价，WYSIWYG 固有行为）。
- **自定义语法**：
  - **Admonition**：`admonitionPlugin.ts`（`$remark` mdast 变换 + remark-stringify handler）+ schema + `admonitionView.ts`（复用 preview 的 `.admonition` CSS）。两个坑：① commonmark 的 remarkLineBreak 会融合软换行，变换必须排在它之后并炸裂融合段落；② admonition schema 注册顺序不能先于 paragraph（PM createAndFill 递归栈溢出）。
  - **PlantUML**：`plantUmlCodeBlockView.ts`——`$view(codeBlockSchema.node)` 按 `language` attr 渲染「预览图 + 可编辑源码」，编码逻辑共用 `src/lib/plantuml.ts`（parser.ts 已改为调用）。
  - **本地图片**：`imageView.ts`——只改 DOM 的 src，节点 attrs 保持原文（序列化无损），解析逻辑共用 `src/lib/imageSrc.ts`。相对路径三种形态（`./x` `../x` 与裸相对路径 `images/x.png`）都经 `resolveToAbsoluteImagePath` 基于 baseDir 解析；裸相对路径曾不解析导致图片 404（2026-08-04 修复，preview 的 `preprocessImages` 同构修复）。
- **isTauri() 的正确写法**：Tauri v2 运行时总是注入 `window.__TAURI_INTERNALS__`（invoke 依赖它），而 `__TAURI__` 仅在 `withGlobalTauri: true` 时才存在（本项目未开启）。检测 Tauri 环境必须查 `__TAURI_INTERNALS__`——此前查 `__TAURI__` 导致 convertFileSrc 路径在生产环境从未生效（preview 靠 base64 兜底才没暴露）。
  - **任务列表**：`taskListItemView.ts` 纯 DOM nodeview，补上 GFM preset 缺失的可点击 checkbox。
- **格式化**：`wysiwygFormat.ts` 的 `applyWysiwygFormat` 覆盖 FormatType 全集（toggle 类走 preset 命令；link 无选区插占位并选中；tasklist 三态）；`insertWysiwygSnippet` 把 markdown 片段解析为 PM 节点插入（不退化成纯文本）。
- **默认模式**：新安装默认 wysiwyg（P0 的强制迁移已删，persist 尊重用户上次选择）。E2E 依赖 source 模式的 spec 用 `e2e/sourceMode.ts` 的 `presetSourceMode(page)` 预置 localStorage。
- **bundle**：Milkdown 使主 bundle 增至约 2.5MB（gzip 814KB），后续可对 WysiwygEditor 做动态 import。

### 已知限制（P3+ 候选）

- wysiwyg 下 Cmd+K / Cmd+1/2/3 快捷键未接（Mod-B/I 由 Milkdown 自带 keymap 支持）
- 表格创建是 Milkdown 的 `|CxR| ` 语法，不是 Typora 的 `|a|b|`+回车；行列增删无 UI
- admonition 无法在编辑器内新建（仅展示/编辑已有），标题 attr 不可编辑
- 代码块在 wysiwyg 下无语法高亮；slash menu / 悬浮格式条未接

---

## 2026-08-04 自绘对话框系统

原生 `confirm()`/`alert()` 在 Tauri WKWebView 中行为不可靠（用户报告：新建文件确认框点 Cancel 仍执行了清空，Chrome 中同逻辑验证正常）。已全部替换为自绘弹窗：

- `src/stores/dialogStore.ts`：`ask(kind, message)` Promise 化挂起 + `answer(value)`
- `src/lib/dialog.ts`：`confirmDialog(message): Promise<boolean>` / `alertDialog(message): Promise<void>`
- `src/components/Dialog.tsx`：全局单例弹窗（App 挂载），风格对齐 TableDialog；Esc/overlay 取消、Enter 确认
- 6 处调用点（Toolbar/useKeyboardShortcuts/Sidebar/FileTree/useFileDragDrop）全部改为 `await confirmDialog(...)`；生产代码已无原生 confirm/alert

---

## 2026-08-05 Logo 重设计（V + 光标）

新 logo：紫色渐变（#6366F1→#8B5CF6→#D946EF）+ 白色 V 字母 + 琥珀色光标下划线。矢量源 `src-tauri/icons/icon.svg`，方案对比图与母版在 `docs/images/logo-concepts/`。

**macOS 图标安全区**：Big Sur 起图标内容只能占画布的 ~80%（1024 画布中 824），全幅图标在 Dock 会比其他应用大一圈。重新生成图标时必须用带 80% 内边距的母版（`docs/images/logo-concepts/a-vivid-v-padded-1024.png`）执行 `pnpm tauri icon <母版>`。
