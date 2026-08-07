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

- 表格创建是 Milkdown 的 `|CxR| ` 语法，不是 Typora 的 `|a|b|`+回车；行列增删无 UI
- admonition 已有块的类型/标题 attr 在编辑器内不可修改（需切 source 改围栏行）
- slash menu / 悬浮格式条未接；WYSIWYG 查找替换未接（Find 仅 source/split）

---

## 2026-08-05 WYSIWYG 编辑体验补全（代码块高亮 / 语言输入框 / admonition 新建 / 快捷键）

### 代码块语法高亮（codeHighlightPlugin.ts）

- 方案：highlight.js（已有依赖，与预览 parser.ts 同引擎）分词 → PM inline decorations，span 挂全局 `.hljs-*` 类（globals.css 亮暗双套裸类选择器直接生效，无需新增样式）。
- `hljs.highlight(...).value` 的 HTML 写入游离 div 递归遍历，展平为 `{from, to, cls}` 区间（嵌套 span 类名栈合并）；偏移以代码块内容起点 `pos + 1` 为基准。
- 缓存 `Map<lang+code, spans>`（200 条 FIFO）：每次 docChanged 全量重建 decorations，但只有内容变过的块重新分词。
- 只认显式 `language`（无语言/未知语言/plantuml 跳过），不做 highlightAuto——避免误判闪烁与击键开销，与 Typora 行为一致。

### 代码块语言输入框（plantUmlCodeBlockView.ts 扩展）

- 非 plantuml 分支的 `pre` 加 `hljs` class（基色/等宽规则与预览一致），`pre` 内追加 `<input class="code-block-lang">`（contentDOM 之外的兄弟节点，PM 不管理）。
- 提交：Enter/blur → `setNodeMarkup(getPos(), …, {language})`；Escape 还原；无变化不 dispatch（避免空事务弄脏文档）。
- nodeview 三件套：`stopEvent` 拦截 input 内事件（按键不交给 PM）、`ignoreMutation` 由「非 contentDOM 即忽略」天然覆盖、`update()` 在非聚焦时同步 input.value（undo/外部变更）。
- 输入 `plantuml` 走既有「update 返回 false 重建 nodeview」路径，自动切换为预览双区。

### Admonition 编辑器内新建

- 链路：InsertMenu「提示框」→ `AdmonitionDialog`（9 类型网格复用 `.admonition` CSS 渲染迷你预览 + 可选自定义标题）→ dispatch `editor-insert`，片段 `::: {type}{ title}\n\n:::\n`。
- WYSIWYG 侧 `insertWysiwygSnippet` 经 remark 变换天然解析为 admonition 节点；光标修正条件从 table/code_block 扩到 admonition（落入容器内首个块）。source 模式由 CM 直接插文本，零改动。

### WYSIWYG 快捷键（wysiwygFormat.ts 的 wysiwygShortcutPlugin）

- `$prose((ctx) => keymap({...}))`：Mod-K 链接、Mod-1/2/3 标题 1/2/3，处理函数复用工具栏同一套 `applyLink`/`applyHeading`（行为两端一致）。
- Mod-B/I 由 Milkdown commonmark 自带 keymap 提供；原生菜单 accelerator 未占用这三个键（视图切换是 Cmd+Alt+1~4），桌面/浏览器均直达 webview。

### 中文 IME 组合输入系列问题（最终形态，2026-08-06）

这一系列问题（`\` 垃圾行、换行拼接、幻影空行、`<!-- -->` 注释包裹）都发生在 WKWebView + macOS 拼音的组合输入路径上，互相纠缠，最终拆解为六个独立机制：

**1. 幻影节点（`\`/空格垃圾）— strictBrParserPlugin.ts（ignore 语义）**
- 机制：组合输入时浏览器在 DOM 插入无属性 `<br>` 占位（预编辑文本分音节处、块尾），PM 回读时按默认规则解析成 hardbreak 节点（序列化为 `\`）或空格文本。
- 修复：自定义 `domParser` 视图 prop（readDOMChange 与剪贴板解析都经 `someProp("domParser")` 命中）：`br[data-type="hardbreak"]` → hardbreak 节点（PM 渲染的 hardbreak 必带此属性，回读无损，`data-is-inline` 经 getAttrs 保真）；裸 `<br>` → `ignore: true` 整块跳过（**不产生任何节点或文本**）。
- 教训：v1 曾用 `getAttrs: false` 拒绝裸 br——落入 leafFallback 变成 `\n` 文本、折叠成空格，空格混进文本流干扰 PM 的 diff 对齐，导致上屏错位（「拼接」回归）。**让幻影消失必须什么都不产生**。
- 注意：PM Plugin 构造器的 bindProps 会立即读取 props 值（getter 惰性求值不可行）；`$prose` 工厂在 SchemaReady 后执行，`ctx.get(schemaCtx)` 直接可用。

**2. 残留兜底 — hardbreakCleanupPlugin.ts（延迟清理）**
- 规则：①纯 hardbreak 段落删除（唯一子节点时替换为空段落，满足 `block+` 约束）；②文本段落内 ≥2 连续非 inline hardbreak 运行段删除（合法 Shift+Enter 只会产生单个）；③文本块内 ≥3 连续 ASCII 空格删除（macOS 拼音预编辑文本的分音节空格 span 残留；≤2 保留，代码块不动）。
- 时机：仅 composition-meta 事务；**上屏事务 dispatch 时 PM 仍处于 composing 状态**（compositionend 事件更晚到），此时不能 dispatch——记标记，compositionend 后延迟 50ms 统一清理（晚于 PM 的 scheduleComposeEnd 20ms flush；若新一轮组合已开始则顺延）。

**3. 换行被吞/拼接 — imeEnterGuardPlugin.ts**
- 机制：prosemirror-view 的 `inOrNearComposition` kludge——`safari` 判定（navigator.vendor 含 Apple，WKWebView 命中）下 **compositionend 后 500ms 内第一个非组合态 keydown 被整个忽略**（本意是吞掉 IME 确认上屏时 Safari 补发的配对 Enter）。中文用户「选词上屏→立刻回车」的 Enter 被吞 → 新段落没建成 → 后续文本接到上一行（「拼接」）。插件的 handleKeyDown 看不到这次按键（PM 提前返回），只能从 DOM 事件层补。
- 修复：view.dom 的 **capture 阶段**监听（先于 PM 冒泡处理器，不依赖注册顺序）；直接读写 PM 的 `input.compositionEndedAt`（不维护镜像状态，与 kludge 天然同步）；命中窗口内 Enter 就 preventDefault + stopImmediatePropagation + 手动执行与正常 Enter 相同的 `wysiwygEnterCommand`——**有且仅有一次分段**。60ms 下界：确认上屏的配对 Enter 与 compositionend 同刻到达，放行给 kludge。代码块内不补偿。
- 测试注意：jsdom 默认 vendor 就是 "Apple Computer, Inc."，PM 的 safari 标记在模块加载时固化——测试里 kludge 真实生效；补偿事务带 `imeEnterGuardCompensation` meta 供探针计数。

**4. `<!-- -->` 注释包裹 — 不是序列化 bug，是 CodeMirror 的按键冲突**
- 机制：`@codemirror/commands` 的 defaultKeymap 把 **Mod-/ 绑定到 toggleComment**（`<!-- -->` 正是 markdown 的注释语法）。源码模式按 Cmd+/ 想切视图，CM 顺手把当前行/选区注释掉；再按一次又解开（toggle）。admonition 围栏、代码块收尾围栏被裹都是它。
- 排查手段值得记录：所有序列化路径查无产出者后，给 `store.setContent` 包装调用栈记录，直接指名写入者。
- 修复：CodeMirrorEditor 装配时从 defaultKeymap 过滤掉 `Mod-/`（模式切换走 window 级监听，CM 不拦截传播，两者都能收到按键）。

**5. 单换行 Enter 模型 — wysiwygFormat.ts 的 wysiwygEnterCommand**
- 用户约定：普通段落 Enter = 行内软换行（isInline:true hardbreak，序列化为单个换行符，行间无空行）；段尾已是换行时再按 → 折叠为新段落（Enter×2 = 新段落，段落语义入口）。列表走 splitListItemCommand（**prosemirror 原版 splitListItem 与 Milkdown 列表自定义 attrs 不兼容，会抛 TransformError**）；代码块/表格交默认。
- 坑：Milkdown 的 `hardbreakClearMarkPlugin` 在带 `hardbreak` meta 的事务后会把节点 attrs 重置为默认（isInline 被抹成 false）——插入事务**不能带 hardbreak meta**。
- 渲染：isInline 软换行默认渲染成带空格的 span（不换行，多行会挤成一行）——`hardbreakView.ts` nodeview 统一渲染为 `<br>`（属性保留供解析器回读）。
- 优先级：wysiwygEnterPlugin 在 wysiwygPlugins 数组首位（keymap 先匹配）。

**6. macOS 智能替换（引号变全角）**
- WKWebView contenteditable 默认启用系统智能替换（弯引号/自动大写），会悄悄改写文档字节。WYSIWYG 根节点设 `autocorrect=off autocapitalize=off`（WysiwygEditor 创建后 setAttribute）；代码块 pre 额外 `spellcheck=false`。CM6 默认已全关（contentAttrs 内置）。
- **既有垃圾文件**：清理机制只防新增；文件里已存在的 `\`/`<!-- -->` 残留需在源码模式手动删一次。
- **同类已知残留**：PM kludge 吞的是「第一个 keydown」不区分键——上屏后 500ms 内的第一个 Backspace 也会被吞（按第二次即可），影响轻微未处理。

### Admonition 结束围栏融合（`<br />\n:::` 被 html 块吞掉）

- **机制**：admonition 末块是空段落时，Milkdown 的 paragraph 序列化器把它编码为 html 节点 `<br />`，且紧贴结束围栏输出（`<br />\n:::`）；重解析时 micromark 把 `<br />` 当作 html 块起始，**html 块一直吞到空行才停**——结束围栏被吞进 html 节点（`value: "<br />\n:::"`），remarkPreserveEmptyLinePlugin 的精确匹配剥除也因此失效，admonition 整体降级为普通文本。同类风险：末块是 blockquote 时 `:::` 被懒惰延续吞掉。
- **修复**（`admonitionToMarkdown`）：①序列化前丢弃尾部空段落（空行在 markdown 本无语义）；②结束围栏前强制输出一个空行（`\n\n:::` 成为规范形态，旧写法解析后规范化一次）。空 admonition 的不动点是 `::: note\n:::`。有回归测试锁定（尾部空段落/空容器/末块 blockquote 三种形态）。

### explodeParagraph 换行保真

- 重拼融合段落时，段间插入**原始 break 节点**而非新建 `isInline:true` 的软换行——此前硬换行（`\`）经过 admonition 解析会被改写成软换行，导致含硬换行的内容每次往返都被悄悄改写。


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

---

## 2026-08-05 P4 侧栏/工具栏优化与 P3 关联项（主题/菜单/标题栏/文件树）

### dark 变体失灵根因与 @custom-variant 修法

- **根因**：Tailwind CSS 4 的 `dark:` 变体默认编译为 `prefers-color-scheme` 媒体查询，应用内手动切换 `.dark` class 完全不影响 `dark:` 样式——表现为暗色切换"半失灵"。
- **修法**：`globals.css` 顶部声明 `@custom-variant dark (&:where(.dark, .dark *))`，把 `dark:` 重定义为跟随 `.dark` class；`.dark` 由 App.tsx effect 挂到 `documentElement`（原来挂根 div，Portal/overlay 组件吃不到暗色）。
- **变量收编**：新增 `--hover-bg` / `--active-bg` / `--color-text-muted`（:root 与 .dark 双定义），Sidebar/FileTree/Toolbar/App 的 Tailwind 硬编码灰色全部替换为变量。**约定：新组件禁止 Tailwind 灰色硬编码，颜色一律走 CSS 变量。**

### persist v0 → v1 迁移要点

- persisted `themeMode: 'light'|'dark'|'system'`（默认 system）取代持久化的 `isDarkMode` bool；`isDarkMode` 变为派生非持久化字段（`resolveTheme(themeMode, getSystemDark())`，见 `src/lib/theme.ts`）。
- `version: 1` + `migrate`：旧版 persist 数据里的 `isDarkMode: true/false` 映射为 `themeMode: 'dark'/'light'`。
- 自定义 `merge`：rehydrate 时用持久化的 themeMode + 当前系统偏好重算 `isDarkMode`，不复用快照里的旧值。
- 系统主题变化经 `setSystemDark` 回写，`themeMode: 'system'` 时实时跟随；`toggleDarkMode` 语义变为 light↔dark 显式切换。

### 菜单原语（src/components/Menu/）

- `Dropdown`：trigger + 面板，外部点击/Escape 关闭，`align: left|right`；`ContextMenu`：受控组件，fixed 坐标 + 边界翻转，props `{x, y, items, onSelect, onClose}`；`MenuPanel`：统一渲染 item（`{id,label,icon?,shortcut?,checked?,disabled?} | {divider:true}`）；`menuPosition.ts` 的 `resolveContextMenuPosition` 是纯函数可单测。
- **坑**：ContextMenu 的 `onClose` 必须 `useCallback` 稳定化，否则父组件重渲染会导致菜单意外关闭。
- FormatMenu / HeadingDropdown / InsertMenu / MoreMenu 已重构复用 Dropdown；**禁止再复制 outside-click 模式自绘菜单**。

### macOS 融合标题栏注意点

- `tauri.conf.json` windows 配置 `"titleBarStyle": "Overlay", "hiddenTitle": true`（仅 macOS 生效，Windows/Linux 忽略）。
- `hiddenTitle` 后系统不再绘制标题，需自绘：Toolbar 居中渲染文件名（含脏标记 ●），`hidden min-[760px]:block` 窗口过窄时让位给控件；仅 macOS + Tauri 运行时渲染（`src/lib/platform.ts` 的 `isMacOSDesktop`，App 同时给 documentElement 加 `is-macos` class）。
- 拖拽与 traffic light：Toolbar 根节点加 `data-tauri-drag-region`，macOS 下左侧 `pl-[78px]` 预留红绿灯区域。

### 文件树 collect/apply 刷新策略

- 文件管理操作（新建/重命名/删除）后需重新 `read_directory`，但重建会丢展开状态。解法：操作前 `collectExpandedPaths()` 收集展开目录路径集合，刷新后 `applyExpandedPaths()` 按路径恢复；当前文件父链强制展开。
- 过滤搜索：query 非空时 `filterTreeByQuery`（保留祖先链）并临时全展开；清空后回到"第一层展开 + 当前文件父链展开"策略（`expandFirstLevel`）。
- 重命名当前打开文件必须同步 store 的 `filePath`/`fileName` 并 `renameRecentFile`，否则自动保存会写到旧路径。

## 2026-08-06 编辑器右键菜单（Source / Preview / WYSIWYG 三区域）

在文件树之后，右键菜单覆盖到编辑器全部三个区域。分层：菜单项构建是纯函数，动作执行按 id 前缀分发，区域各自只持有「打开菜单 → 渲染 → 分发」的薄壳。

### 分层结构

- **`src/lib/contextMenu.ts`（纯函数，可单测）**：`buildSourceMenuItems` / `buildWysiwygMenuItems` / `buildPreviewMenuItems` 输出 `MenuItem[]`（id、i18n 文案、`disabled`、分隔线、快捷键标注）；`getShortcutLabels(isMac)` 出 ⌘/Ctrl+ 两套标注（仅展示——桌面端带 accelerator 的键由原生菜单/OS 处理）。WYSIWYG 构建器接收 `WysiwygMenuContext` 快照（inTable/inTableHeader/linkHref/onImage/inCodeBlock），上下文组排最前，尾部分隔线去重。
- **`src/hooks/useContextMenu.ts`**：受控状态（坐标 + 打开时刻的上下文快照 data），`openMenu` 做 preventDefault/stopPropagation，`closeMenu` useCallback 稳定化（Menu 原语的老约定）。
- **动作分发（各编辑器组件内）**：`format:*` → 既有 editor-format 通道（CM `runFormat` / `applyWysiwygFormat`，行为与工具栏一致）；`undo/redo` → 各自 history；剪贴板 → `src/lib/clipboard.ts`。

### 剪贴板（src/lib/clipboard.ts + 新依赖）

- 桌面端 WKWebView 的 `navigator.clipboard.readText` 不可用，必须 **`@tauri-apps/plugin-clipboard-manager`**（npm 2.3.2 + Cargo `tauri-plugin-clipboard-manager = "2"` + `lib.rs` 注册 + capabilities `clipboard-manager:default`）；浏览器 dev/E2E 降级 `navigator.clipboard`。失败返回 null/false 并记日志，调用方零 try/catch。
- WYSIWYG 的 copy/cut 序列化为**纯文本**（`doc.textBetween`）——保留格式的剪贴板序列化未接，属已知限制；paste 读剪贴板后按 markdown 解析插入（与 Milkdown 原生粘贴一致，`insertWysiwygSnippet`），异常输入回退纯文本。

### WYSIWYG 上下文（wysiwygContextMenu.ts）

- **光标先行**：contextmenu 时 `posAtCoords` 换算落点，落在选区外则先把 `TextSelection.near` 光标移过去（编辑器标准行为），上下文解析与动作都以新光标为准。
- **链接**：`getLinkRange` 按「光标落在带 link mark 的文本节点内（含右边界）」命中并向两侧同 mark 节点扩展——自实现而非 tiptap 版 `getMarkRange`，因为后者在 `parentOffset=0` 边界取不到节点。
- **表格**：行/列**新增**复用 milkdown gfm 命令（`addRowBeforeCommand` 等，作用于当前选区）；行/列/整表**删除**是自实现 PM transaction（按 `$from.index(tableDepth)` 算行 index、逐行收集单元格删除区间后从后往前删）——不走 milkdown `selectRowCommand` + `deleteSelectedCellsCommand` 的 index 语义组合。schema 注意：表头是独立节点类型 `table_header_row`，markdown 表格必须有表头 → 表头行禁删行（菜单 disabled + 动作层双保险）；仅剩一列时删列退化为删整表。
- **图片**：atom 节点无内部光标，右键时 `nodeBefore/nodeAfter` 判定与删除。
- **E2E 坑**：Preview 的 `.markdown-body` 选择器会命中常驻挂载但隐藏的 `.markdown-body.wysiwyg-editor`，测试里要用 `.markdown-body.p-8` 区分。

### 右键菜单 Typora 化重组与插入段落（2026-08-07 补充）

- **MenuPanel 子菜单**：`MenuSubmenuItem { children: MenuItem[] }`（一层嵌套）。子菜单面板挂在触发行的 relative 容器内（`left-full -ml-1` 轻微重叠，hover 平移无间隙不断开）；展开时按触发行 `getBoundingClientRect` 修正：右缘放不下翻到左侧（`right-full`），底部溢出向上收拢。普通项/分隔线 hover 收起已展开子菜单；子菜单触发行的 click 只展开不下发 id。
- **菜单结构对齐 Typora**：Source = 基础组 + 段落▸（format:h1-h3/quote/list/tasklist/codeblock，全部复用既有 formatTransaction）+ 格式▸；WYSIWYG = 上下文组 + 基础组 + 段落▸（多「正文」`block:paragraph` = setBlockType paragraph）+ 格式▸ + 插入▸（图像/表格/代码块/水平分割线 + 在上方/下方插入段落）。
- **insert:\* 动作**：`insertWysiwygSnippet`  markdown 解析插入（表格片段复用 `generateTable(2,2)`）；注意 Milkdown 序列化水平分割线为 `***`。
- **在上方/下方插入段落**：`$from.before(1)` / `$from.after(1)` 定位当前**顶层块**边界，插空段落 + `TextSelection.near(pos+1)` 落入光标——解决表格/代码块紧贴文档边缘或彼此相邻时无法插出新段落的问题。

### 空段落序列化为 `<br />` 的问题（2026-08-07）

- **现象**：WYSIWYG 下块级元素（代码块/表格）之间残留的空段落，序列化成独立 `<br />` 行，源码被污染。
- **根因**：Milkdown commonmark 预设自带 `remark-preserve-empty-line`——paragraph 序列化器对空段落（非文档末节点）输出 `<br />` html 节点（见 preset-commonmark `paragraphSchema.toMarkdown` 的 `shouldPreserveEmptyLine(ctx)` 检查）；解析侧 `visitEmptyLine` 把独立 `<br />` 行从 mdast 摘除。这是 Milkdown 的「空行无损」设计，但对用户是垃圾行。
- **修法**：`wysiwygPlugins.ts` 按二元组引用比较从 commonmark 预设中剔除该插件（`commonmark.filter(p => !preserveEmptyLineParts.has(p))`）。剔除后：空段落序列化为普通空行（markdown 渲染本来就会折叠，重载时自然消失）；源码已有的 `<br />` 行解析为 html 节点保留不丢；空表格单元格序列化为 `|  |`（GFM 合法）。
- **注意**：`$remark` 返回 `[pluginCtx, plugin]` 二元组，commonmark 数组里是两个独立条目，过滤时两个都要剔除。

### 右键 WebKit 抢选问题（2026-08-07，探针定位）

- **现象**：WYSIWYG/Source 右键点击行首会选中相邻第一个词、空行选中整行（菜单动作随之作用于错误选区）。
- **探针结论**（`save_file` 写 /tmp 日志，事件级时序）：WebKit/WKWebView 在右键 `mousedown`→`contextmenu` 之间把词/行选择写入 DOM——**不可取消的内部步骤**（`mousedown`/`contextmenu` 的 preventDefault 都无效）；此刻编辑器内核（PM/CM）状态尚未被污染，但随后经 `selectionchange` 采纳 DOM 选择，污染固化。
- **修法（覆盖而非拦截）**：`contextmenu` 时 `posAtCoords` 求落点 → 落点在选区外则 dispatch 折叠选区到落点 → **再直接 `window.getSelection().collapse(view.domAtPos(head))` 把 DOM 选择压回光标**。内核随后同步到的就是光标。mousedown 快照/preventDefault 均无效已移除。
- **注意**：`TextSelection.near` 找不到文本位置时会退回 NodeSelection；`domAtPos` 极端位置可能抛错（try/catch 忽略即可，内核侧选区仍正确）。

## 2026-08-07 P5：菜单补全 / Dock 菜单 / 文件关联 / 拖拽修复

### 标题栏无法拖拽的根因（双重）

1. **ACL 缺权限**：tauri 2.10 的窗口插件权限表中 `start_dragging` **不在** `core:default` 默认集（`build.rs` PLUGINS 里 `("start_dragging", false)`；而 `internal_toggle_maximize` 是 `true`——这解释了「双击能放大、按住拖不动」）。Tauri 注入的 `drag.js` 调 `plugin:window|start_dragging` 被 ACL 静默拒绝。修复：`capabilities/default.json` 显式加 `"core:window:allow-start-dragging"`。
2. **drag.js 无上溯**：`e.target.getAttribute('data-tauri-drag-region')` 只查目标元素自身（无 `closest()`）。Toolbar 根节点带属性但被子元素（按钮组/分隔条）大面积覆盖，命中子元素即不拖。修复：左/右分组容器也挂 `data-tauri-drag-region`（按钮/SVG 无属性，点击不受影响）。

### 段落/格式菜单与快捷键路由

- 菜单 id 与右键菜单同源：`format:<FormatType>` → `editor-format` 事件总线；`insert:image` 走 `editorActions.insertImageFromPicker`、`insert:table|admonition` → `app-open-dialog` 事件（Toolbar 挂载对话框）、`insert:hr` → `editor-insert`。
- **⌘B/I/K/1-6/⌘0 桌面端改由菜单事件驱动**（accelerator 被 OS 拦截，webview 收不到 keydown）；浏览器 dev/E2E 无原生菜单，CM keymap / Milkdown keymap / useKeyboardShortcuts 照旧——「互不重迭」模式同 ⌘O/S/N。
- ⌘0 让位给段落菜单「正文」（剥块级前缀）；实际大小改 ⇧⌘0（MoreMenu 标注同步；Editor.tsx 浏览器侧两个组合都接）。
- `FormatType` 扩 h4-h6/ol/paragraph：CM 侧 `matchBlockPrefix` 统一识别标题/`> `/`- [ ] `/`- `/`\d+. ` 前缀（修复任务项转格式残留 `[ ] ` 的旧 quirk；ol 按实际编号 toggle）；paragraph = 剥前缀专用路径（`formatTransaction` 前置分支，不经 isBlockFormat）。Milkdown 侧 `applyParagraph`：list_item→liftListItem、blockquote→lift、其他→setBlockType(paragraph)。

### macOS Dock 右键菜单（objc2）

- Tauri 2.10 / muda 0.17 / tao 0.34 均无 Dock 菜单 API（仅 `set_dock_visibility`）。实现：setup 时取 `NSApplication.sharedApplication().delegate()`（tao 的 AppDelegate 实例）→ `class_addMethod(applicationDockMenu:, "@@:@")` 注入 IMP，返回全局缓存的 `NSMenu`（`Mutex<Option<Retained<NSMenu>>>`，unsafe Send/Sync 包装，全部主线程访问）。
- 菜单项 target 是 `define_class!` 的 `VividMarkDockMenuTarget`（NSObject 子类，newDocument:/openDocument:/openRecent:/clearRecent:），点击 emit `native-menu-event` **复用前端全部分发**；最近文件路径不经 representedObject（避免 downcast），用 `NSMenuItem.tag` 索引全局路径表。
- 防御：`class_respondsToSelector` 先检测，tao 未来若自带该方法则跳过不覆盖。**tao/tauri 升级需回归验证此点**。
- 重建：前端 `rebuildMenu` 同订阅点调 `update_dock_menu`（非 macOS 注册 no-op 桩 command）；依赖版本与 tao 0.34 对齐（objc2 0.6 / objc2-app-kit 0.3 / objc2-foundation 0.3），避免双主版本。

### 文件关联（Open With）

- `tauri.conf.json` `bundle.fileAssociations`（md/markdown/mdown/mkd，role=Editor）→ 打包生成 macOS `CFBundleDocumentTypes`（Open With 列表出现，非默认 handler）、Windows 注册表项、Linux mime。**仅打包安装的 .app 生效**（LaunchServices 在安装/首次启动注册），`pnpm tauri:dev` 验证不了。
- 运行时：macOS 双击/打开方式 → `RunEvent::Opened { urls }`（同一运行实例接收，不会另起进程）→ `lib.rs` 改 `build().run(|app, event|)`：路径入队（`PENDING_OPEN_FILES`）+ emit `file-open-request`。前端 `openWith.ts` 先注册监听、再 `take_pending_open_files` 取冷启动积压；热打开走 payload 并顺手清空队列。Windows/Linux 是拉起新进程传 argv（无 Opened 事件），argv/single-instance 留后续。
- **平台门控坑（v0.2.3 CI 实踩）**：`RunEvent::Opened` 变体本身是 `#[cfg(any(target_os = "macos", target_os = "ios"))]`，Windows/Linux 编译直接 E0599——macOS 本机打包发现不了。事件分支与 `handle_opened_urls` 都需 `#[cfg(target_os = "macos")]` 门控（闭包参数改 `_app/_event` 避免其他平台 unused 警告）。新增平台专属 API 时先在 registry 源码确认其 cfg 条件。

### 2026-08-07 追加修复（右键误触 resize / 视图菜单混淆项）

- **右键触发侧栏调宽**：`useResizable.handleMouseDown` 未检查 `e.button`，右键（button=2）按下也会进入 resize 态（contextmenu 与 mousedown 同序列）——侧栏右缘 4px 热区上右键打开菜单时同时开始调宽。修复：仅 `e.button === 0` 响应。同序问题：分隔条 `title` 硬编码英文 → 走 i18n（`sidebar.dragToResize`）。
- **视图菜单「源代码模式」移除**：⌘/ 切换项与四个视图模式 check 项（所见即所得/源码/分屏/预览）并列引发歧义。Typora 只有双态所以没有这个问题；VividMark 四模式组的显式项已是权威入口。菜单项删除后 ⌘/ 桌面端无 accelerator 占用，keydown 直达 webview 由 `useKeyboardShortcuts` 处理（与改造前行为一致）。
- **WYSIWYG 表格行高虚高**：Milkdown 表格单元格内容被 `<p>` 包裹，`.markdown-body p` 的 1em 段落下边距计入行高（58px vs 预览 47px）。修复：`th/td > p { margin: 0 }`（预览无 p 包裹不受影响），修后 44px。
