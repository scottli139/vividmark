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
- [Tauri Commands 一览](#tauri-commands-一览)
- [键盘快捷键一览](#键盘快捷键一览)
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

> ✅ 已解决（Typora 式直存）：导出改为「保存对话框 → 静默生成 PDF 文件」，文件名即用户所选，不再经过打印对话框。见下文「Export PDF 详解」。

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
pnpm add @plantuml/core    # 本地渲染引擎（TeaVM 编译，MIT，离线）
pnpm add plantuml-encoder  # 在线服务 URL 编码（本地渲染失败时的回退路径）
```

**Implementation:**
Two syntax entries, both produce placeholders (async local rendering):

1. **Code block syntax** (` ```plantuml ``` `) - handled in highlight function
2. **Inline syntax** (`@startuml...@enduml`) - preprocessed before markdown parsing

两处入口统一产出 `data-plantuml-src` 占位符，由本地引擎（`src/lib/plantuml.ts renderPlantUmlSvg`）离线渲染为内联 SVG，失败回退 plantuml.com 在线图。引擎选型、串行队列、暗色与测试策略详见文末「2026-08-14 PlantUML 本地渲染」一节。

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

### 数学公式 (KaTeX)

双端实现，两侧语法规则必须严格一致（不一致会导致 Source/WYSIWYG 模式切换时公式抖动）：

- **markdown-it 侧**：`src/lib/markdown/mathPlugin.ts`——自写 inline/block rule（不依赖 markdown-it-katex 等第三方插件）
- **WYSIWYG 侧**：`mathPlugin.ts`（remark-math + `math_inline`/`math_block` atom schema）+ `mathView.ts`（nodeview，点击公式进入 textarea 编辑态）
- **语法规则严格对齐 micromark-extension-math 3.x**：块级公式仅支持多行围栏形式（`$$` 独占行开启/闭合）；单行 `$$x$$` 一律按行内公式解析；不做 pandoc 式货币保护（`$5` 不特殊豁免）
- **PDF 导出**：`exportPdf.ts` 的 `inlineKatexFonts` 把 KaTeX woff2 字体转 base64 内联进导出 HTML——`vividmark-pdf://` 自定义协议窗口加载不到应用内字体，不内联则公式字体缺失

### YAML Frontmatter（2026-08-14）

双端支持，纯函数底座在 `src/lib/markdown/frontmatter.ts`（自 `siteConfig.ts` 迁出并原地再导出，旧导入路径不变）：

- **预览/导出侧**：`parser.ts` 的 `parseMarkdown`/`parseMarkdownAsync` 渲染前 `parseFrontmatter` 剥离——仅文档开头 `---` 围栏生效；**YAML 解析失败保守保留原文**（不强行剥离）；文档中间 `---` 仍是分割线。PDF/站点导出自然继承（站点导出 P1 本就用同一纯函数取 `title`）
- **大纲去噪**：`outlineUtils.extractOutline` 按行数跳过 frontmatter 行范围（块内 `#` 是 YAML 注释不是标题）；**跳过而非剥离文本**，lineIndex/charIndex 保持源码行号（Source 模式跳转依赖）
- **WYSIWYG 侧**：`frontmatterPlugin.ts`（remark-frontmatter + `frontmatter` atom 块 schema，YAML 源码存 attrs.value）+ `frontmatterView.ts`（只读 nodeview：标签 + pre 原文，编辑走 Source 模式）；解析/序列化靠 micromark-extension-frontmatter + mdast-util-frontmatter，value 逐字节保留
- **坑：Milkdown `$remark` 的 options 默认 `{}`**——`$remark(id, factory)` 内部 `initialOptions ?? {}` 并原样 `remark.use(plugin, options)`；校验 options 的 remark 插件（如 remark-frontmatter 把 `{}` 当 matter 对象、缺 `type` 字段直接抛 `Missing type in matter {}`）**必须显式传第三参**（frontmatter 传 `'yaml'`）。后续 Alerts/脚注批次接 remark 插件时注意同款坑

### GitHub Alerts（`> [!NOTE]`，2026-08-17）

双端支持（语法批次 1；纯函数底座 `src/lib/markdown/githubAlert.ts` 的 `matchAlertMarkerLine` 双端共用）：

- **预览/导出侧**：`githubAlertPlugin.ts`——**core rule 后处理 blockquote token**（非块级 rule：CommonMark 引用语义由 block parser 免费获得）。命中（首段首行 `[!TYPE]` 独占一行）后把 blockquote_open/close 改写为 `github_alert_open/close`，渲染复用 `<div class="admonition <type>">` 三段式（CSS 零适配），标记文本与换行从 inline.children 剥离；标记是唯一内容时连空段落三件套一并 splice。rule 放 core 链尾（text_join 之后，标记必为首个 text token）
- **WYSIWYG 侧**：`githubAlertDecorations.ts`——**纯 PM Decoration，零 schema 变更**：命中 blockquote 注入 `admonition <type> github-alert` class（复用 admonition 亮暗配色，与预览视觉一致）+ 首段 `::before` 类型图标 + 标记文本 InlineDecoration 着色加粗。标记行可见可编辑，改 `[!TIP]` 即换色、删 `]` 退回普通引用；带 mark 的标记（`**[!NOTE]**`）不装饰（对齐预览正则口径）
- **识别口径（对齐 GitHub，Obsidian 差异处从严）**：仅五类（note/tip/important/warning/caution）；未知类型、标记同行跟文本、Obsidian 折叠标记 `+`/`-`、标记非首行 → 一律普通引用块，原文保留不丢内容
- **坑：自家序列化产物的两种形态必须容忍**——① Milkdown toMarkdown 把 `[` 转义成 `\[`（防链接误判），保存后的文件标记行是 `\[!NOTE]`；② 行内软换行序列化为 `\`+换行时标记行带 `\` 尾缀。`matchAlertMarkerLine` 正则因此对开括号转义与行尾 `\`/空白均放宽（对 GitHub 严格口径的有意偏差，双端一致性优先）
- Milkdown 硬换行节点名是 `hardbreak`（非 prosemirror-markdown 的 `hard_break`），PM 侧首行截取按此判定

### 脚注（`[^id]`，2026-08-17）

双端支持（语法批次 2）：

- **WYSIWYG 侧零新增 schema**：Milkdown `gfm` 预设自带 `footnote_reference`（行内 atom，attrs.label）/ `footnote_definition`（块，`block+`，dl>dt+dd 结构）节点，remark-gfm 注册的 micromark/mdast 扩展包办解析与序列化——挂载即用，往返字节级无损（`wysiwygRoundtrip.test.ts` 锁定：引用/定义对应、多引用同定义、未引用定义保留、定义位置不归一化）。调研阶段验证过这一点，避免了原计划自写 `$remark` + 双 schema 的方案
- **编号装饰**（`footnoteDecorations.ts`，纯 PM Decoration）：按「引用首现顺序」注入 `data-footnote-number`（与预览侧 markdown-it-footnote 编号口径一致），CSS `font-size:0` + `::before { content: '[' attr() ']' }` 把 label 原文替换为 `[N]` 显示；**悬空引用（定义被删）不编号**——label 原文继续显示，对应预览侧「无定义渲染为字面文本」的降级口径。定义块不编号，`dt` 显示 label 标识符（flex 挂排 `[^label]: 内容`，同 task-list-item 先例）
- **预览/导出侧**：`markdown-it-footnote`（`md.use(footnote)` 注册于 parser.ts）。覆写 `md.renderer.rules.footnote_caption` 恒输出 `[N]`——默认同一定义第二次引用起输出 `[N:M]`，偏离 GitHub/Typora 观感；href/回链 id 仍走默认规则。未引用定义不渲染（同 GitHub）；编号按引用首现顺序、与定义书写顺序无关；同 md 实例连续渲染 env 计数天然隔离（每次 render 传新 env）
- **锚点跳转**：预览点击 `a[href^="#"]` 不再走 `open()` 出站——`Editor.tsx` handlePreviewClick 拦截后 `scrollIntoView` 定位（逐元素比对 id，避开 CSS.escape 的 jsdom 兼容性）。站点导出天然支持页内锚点；`rewriteMarkdownLinks` 对纯 `#` href（pathPart 为空）不重写
- **样式**：globals.css「脚注」一节三端共用（导出经 collectDocumentCss 自动受益）：预览 `.footnotes` 文末区块小字 muted + `scroll-margin-top`；WYSIWYG 角标 accent 色、悬空引用灰色 `[^label]` 形态

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

**Challenge:** Bidirectional scroll synchronization between the source editor and div (preview). 编辑器侧滚动容器是 CodeMirror 的 `view.scrollDOM`（textarea 时代的表述已过时）。

1. **Ref Assignment**: Ensure refs point to scrollable containers, not inner content（同上）

2. **Prevent Scroll Loop**: Use flag + timeout to prevent infinite recursion

   ```typescript
   const isSyncingScroll = useRef(false)

   const handleSourceScroll = useCallback(() => {
     const sourceEl = cmView.scrollDOM // 编辑器侧滚动容器：CodeMirror view.scrollDOM
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
- 标题必须走 `set_window_title` Rust 命令（`src-tauri/src/titlebar.rs`，设题后显式重排红绿灯）；**前端禁止直接调 `@tauri-apps/api/window` 的 setTitle**——会触发 AppKit 把红绿灯按钮弹回默认 y（详见文末「2026-08-14 macOS 红绿灯」一节）
- `core:window:allow-set-title` 属 tauri 2.10+ 非默认权限，capabilities 必须显式授予；缺失时 IPC 被 ACL 静默拒绝、标题恒为 conf 初始值（曾致 Dock 窗口列表全部显示 "VividMark"）

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

Typora 式直存：保存对话框 → 静默生成 PDF 文件，无打印对话框。

### 工作流程

1. **触发** - 原生菜单 `export-pdf`（Cmd/Ctrl+P）/ MoreMenu / Preview 右键菜单，统一派发 `editor-export-pdf` 事件 → `Editor.tsx` 监听并调用 `exportCurrentDocument()`
2. **平台检查** - `pdf_export_supported` 命令（macOS 检查 `WKWebView.printOperationWithPrintInfo` 可用性；Windows 恒 true；Linux false）。不支持 → 直接回退 `print_pdf` 打印对话框
3. **保存对话框** - 前端 `@tauri-apps/plugin-dialog` 的 `save()`，默认 `<文件名>.pdf`
4. **生成导出 HTML**（`src/lib/exportPdf.ts buildPdfExportHtml`）：
   - `parseMarkdownAsync(content, baseDir)` 渲染（与预览同管线，本地图片转 `asset://`）
   - `document.styleSheets` + `adoptedStyleSheets` 序列化为内联 `<style>`（Tailwind/hljs/.markdown-body 全套，与预览像素级一致；不带 `.dark` class → PDF 恒浅色）
   - 追加导出专用 CSS（`@page` 边距、`page-break-inside: avoid`、`print-color-adjust: exact` 保留背景色等）
5. **Rust 渲染与写盘**（`src-tauri/src/pdf.rs export_pdf_file`）：
   - 导出任务经 tokio Mutex 串行排队；HTML 存入全局 slot
   - 创建隐藏 `WebviewWindow`（label `pdf-export`，800×1132），经自定义协议 `vividmark-pdf://localhost/export.html`（Windows 为 `http://vividmark-pdf.localhost/...`）加载 slot 中的 HTML
   - `on_page_load` Finished（≈ load 事件，含图片等子资源）→ 开始打印；15s 超时兜底继续（远程图片不可达时缺图好过失败）
   - 平台原生 print-to-PDF 写入目标路径，`destroy()` 窗口并清空 slot

### 平台实现

| 平台    | 机制                                                                                         | 备注                                      |
| ------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| macOS   | `WKWebView.printOperationWithPrintInfo:` + `NSPrintSaveJob` + `NSPrintJobSavingURL`（objc2） | 需 macOS 11+，否则回退                    |
| Windows | WebView2 `ICoreWebView2_7::PrintToPdf`（webview2-com）                                       | 需 Runtime 1.0.1518.46+，cast 失败回退    |
| Linux   | 不支持（webkit2gtk 2.0 未绑定 `print_to_pdf`）                                               | `pdf_export_supported` false → 打印对话框 |

### macOS 关键坑（spike 实测，macOS 26）

- **`createPDFWithConfiguration:` 不适用**：生成的是整页长截图式单页 PDF，不分页
- **全新 `NSPrintInfo()` + `runOperation()` 会无限分页**（页数爆炸、文件线性增长到 GB 级）；
  必须复刻 wry 的 print 模式：`NSPrintInfo.sharedPrintInfo().copy()`（自带合法纸张）+
  `canSpawnSeparateThread(true)` + `runOperationModalForWindow:delegate:didRunSelector:contextInfo:`，
  完成回调走 delegate 的 `printOperationDidRun:success:contextInfo:`（contextInfo 携带 oneshot sender + delegate Retained 保活）
- 页边距在 Rust 侧 `NSPrintInfo` 设 15mm（42.52pt）；纸张随系统地区（A4/Letter）
- 隐藏窗口（从未 orderFront）可正常打印；背景色需 CSS `print-color-adjust: exact`

### Windows 注意

- `PlatformWebview.controller()` → `CoreWebView2()` → `cast::<ICoreWebView2_7>()`；
  打印设置经 `environment()` cast `ICoreWebView2Environment6` → `CreatePrintSettings()`（开 `ShouldPrintBackgrounds`，边距 0.59in ≈ 15mm）
- 完成回调 `PrintToPdfCompletedHandler::create`（webview2-com 宏生成），`HRESULT + BOOL` 双参数判成败

### 回退与错误处理

- `export_pdf_file` 返回 `error` 以 `unsupported` 开头 → 前端自动回退 `print_pdf`（打印对话框）
- 其他失败 → `alertDialog(t('messages.exportPdfFailed'))`；用户取消保存对话框 → 静默
- 浏览器 dev / E2E（无 Tauri）→ `window.print()`

### 实现文件

| 文件                               | 说明                                                           |
| ---------------------------------- | -------------------------------------------------------------- |
| `src-tauri/src/pdf.rs`             | `export_pdf_file` / `pdf_export_supported` 命令 + 协议 handler |
| `src-tauri/src/lib.rs`             | 协议注册 + `print_pdf`（回退，保持原样）                       |
| `src/lib/exportPdf.ts`             | 前端导出编排 + 导出 HTML 生成 + 回退逻辑                       |
| `src/components/Editor/Editor.tsx` | 监听 `editor-export-pdf`                                       |

### 分页 CSS 的实测结论（与 Typora 对比调试）

- **长表格禁止整表 `page-break-inside: avoid`**：超出一页剩余空间的表会被整体推到下一页，
  前页留大片空白（对比 Typora 时页数 6 vs 3 的主因）。正确做法：表格允许跨页 +
  `tr/td/th { break-inside: avoid }` + `thead { display: table-header-group }`（跨页自动重复表头）
- **WebKit 引擎限制**：多行文本的表格行在页边界处仍可能被行内拆分（`break-inside` 对 tr 不生效，
  WebKit 长期未支持；Chromium/WebView2 正常）。行高越大越容易踩中，暂不规避
- **末尾空白页**：`.markdown-body > :last-child` 的 margin 在内容恰好满页时溢出成空白页，
  导出 CSS 需 `margin-bottom: 0`
- **应用外壳样式必须重置**：序列化全集 CSS 里的 `html, body, #root { height: 100% }` 等需
  `height: auto !important; overflow: visible !important` 覆盖
- **打印密度独立于预览**：导出 CSS 覆盖 `font-size: 14px`（预览 16px）、`td/th padding: 6px 10px`、
  `.markdown-body padding: 0`；`th` + 首列 `white-space: nowrap` 避免「完成」「8/1（六）」这类
  短内容列被内容列挤压折行（首列若是长段落会撑宽表格，属可接受取舍）
- **长代码行折行**：应用侧 `.hljs code { white-space: pre !important }` 会阻止折行导致代码在
  `pre` 边界被裁剪，导出 CSS 需用同优先级+靠后的 `pre code / pre.hljs code / code.hljs`
  选择器组覆盖为 `pre-wrap !important; word-break: break-all !important`
- **表格内图片右侧被裁**：WebKit 把单元格内 `img { max-width: 100% }` 的百分比基准解析为
  padding box（而非 content box），图片宽出左右 padding 各 10px，再被表格圆角的
  `overflow: hidden` 切掉。修复：`td:has(> img) { padding-left/right: 0 }`（内容盒 = 填充盒）
- **满宽表格右边线缺失**：WebKit 打印在页面可打印区边界裁剪内容，collapse 网格的右/下外边线
  外凸半侧边框宽度（100% 宽表格恰好顶到边界）被裁 → 右边线只剩半宽近不可见（屏幕渲染有
  次像素所以预览正常）。修复：导出 CSS `table { width: calc(100% - 2px) !important }`

### PDF 书签大纲（macOS 后处理）

WebKit 打印不生成 PDF outline（Chromium 自动生成，Windows 无需处理）。macOS 在打印成功后用
**PDFKit 后处理**：前端从渲染后 HTML 提取标题（`extractPdfOutline`，DOMParser + textContent，
与 PDF 文本一致）→ `export_pdf_file` 携带 `outline: [{text, level}]` → `add_pdf_outline`：
逐页取 `PDFPage.string()`，与标题做归一化包含匹配（页码游标单调向前，重复标题按序定位），
按 level 用栈建树写入 `outlineRoot` 后 `writeToURL:` 覆盖。

**WebKit PDF 文本提取大坑**：部分汉字被映射为**兼容表意文字**（八→⼋ U+2F08，NFKC 可折叠）
或**康熙部首增补字符**（风→⻛ U+2EDB、门→⻔ U+2ED4，U+2E80–U+2EFF 区块**无** Unicode 分解映射，
NFKC 不折叠），且中英文边界会插入空格。因此 PDFKit `findString:` 精确匹配不可靠，必须：
NFKC 归一 + 去除全部空白 + haystack 侧部首/兼容字符按单字符通配（`pdf_text_contains`）。

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

## Tauri Commands 一览

Defined in `src-tauri/src/lib.rs`（PDF 导出相关在 `src-tauri/src/pdf.rs`，站点导出在 `src-tauri/src/site_export.rs`，多窗口路由在 `src-tauri/src/window_router.rs`，窗口标题在 `src-tauri/src/titlebar.rs`）:

| Command                   | Parameters                | Returns            | Description                                       |
| ------------------------- | ------------------------- | ------------------ | ------------------------------------------------- |
| `read_file`               | `path`                    | `FileInfo`         | Read file content                                 |
| `save_file`               | `path, content`           | `SaveResult`       | Write file content                                |
| `file_exists`             | `path`                    | `bool`             | Check existence                                   |
| `read_directory`          | `ReadDirectoryParams`     | `FileTreeItem[]`   | File tree data                                    |
| `create_file`             | `path`                    | `null`             | Create empty file                                 |
| `create_folder`           | `path`                    | `null`             | Create directory                                  |
| `rename_path`             | `oldPath, newPath`        | `null`             | Rename/move file or folder                        |
| `delete_path`             | `path`                    | `null`             | Delete (folder: recursive)                        |
| `copy_path`               | `oldPath, newPath`        | `null`             | Copy (folder: recursive)                          |
| `reveal_in_folder`        | `path`                    | `null`             | Reveal in system file manager                     |
| `pdf_export_supported`    | —                         | `bool`             | 平台是否支持 PDF 直存（macOS/Windows 支持）       |
| `export_pdf_file`         | `html, outputPath, title` | `ExportPdfResult`  | 隐藏窗口渲染 → 原生 print-to-PDF 静默写文件       |
| `print_pdf`               | `fileName`                | `ExportPdfResult`  | 打印对话框（PDF 直存不支持时的回退路径）          |
| `export_site`             | `params(outputDir,files)` | `ExportSiteResult` | 「导出为网站」批量写盘（文本写入 + 资产镜像复制） |
| `rebuild_menu`            | `lang, recentFiles`       | `null`             | Rebuild native menu (i18n / recent files)         |
| `set_menu_item_enabled`   | `id, enabled`             | `null`             | Native menu item enabled state                    |
| `set_menu_item_checked`   | `id, checked`             | `null`             | Native menu check item state                      |
| `update_dock_menu`        | `lang, recentFiles`       | `null`             | Rebuild macOS Dock menu（其他平台 no-op）         |
| `report_window_state`     | `path, dirty`             | `null`             | 前端上报本窗口文档状态（窗口注册表）              |
| `open_in_new_window`      | `path?`                   | `String`(label)    | 新建文档窗口（file-new / 路由新建）               |
| `route_open`              | `paths`                   | `null`             | 打开路径智能路由（聚焦/复用/新建）                |
| `take_startup_open_files` | —（按窗口 label）         | `String[]`         | 取走本窗口启动待打开队列                          |
| `set_window_title`        | `title`                   | `null`             | 设窗口标题并重排红绿灯                            |

新增命令：实现 `#[tauri::command]` → 注册进 `generate_handler![]` → 前端经 `@tauri-apps/api/core` invoke。结构体字段跨桥为 camelCase（`#[serde(rename = "isDirectory")]`）。

## 键盘快捷键一览

带 accelerator 的键在桌面端被 OS 拦截（webview 收不到 keydown）——桌面端快捷键全部由原生菜单事件驱动；`useKeyboardShortcuts.ts` 仅在浏览器 dev/E2E 生效，两者互不重迭。

| Shortcut                           | Action                                 | Implementation                                                                                                            |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Cmd/Ctrl + O / S / Shift+S`       | Open / Save / Save As                  | 原生菜单（桌面端）/ `useKeyboardShortcuts.ts`（浏览器）                                                                   |
| `Cmd/Ctrl + N`                     | 新建**窗口**（多窗口 SDI）             | 原生菜单 → open_in_new_window；浏览器端仍为原地新建（`useKeyboardShortcuts.ts`）                                          |
| `Cmd/Ctrl + Shift+O`               | 打开文件夹                             | 原生菜单（文件菜单）                                                                                                      |
| `Cmd/Ctrl + /`                     | WYSIWYG ⇄ Source 切换                  | `useKeyboardShortcuts.ts`（刻意不入菜单——与视图模式 check 项并列易混淆；桌面端无 accelerator 占用，keydown 直达 webview） |
| `Cmd/Ctrl + B / I / K`             | Bold / Italic / Link                   | 原生菜单（格式菜单，桌面端）→ editor-format；浏览器走 CM keymap / Milkdown keymap                                         |
| `Cmd/Ctrl + 0`                     | 正文（剥掉块级前缀）                   | 原生菜单（段落菜单，桌面端）                                                                                              |
| `Cmd/Ctrl + 1 ~ 6`                 | Heading 1 ~ 6                          | 原生菜单（段落菜单，桌面端）→ editor-format；浏览器走 CM keymap / `wysiwygShortcutPlugin`（仅 1~3）                       |
| `Cmd/Ctrl + Alt+Q / U / O / X / C` | 引用 / 无序 / 有序 / 任务列表 / 代码块 | 原生菜单（段落菜单，桌面端）→ editor-format                                                                               |
| `Cmd/Ctrl + Shift+V`               | 粘贴为纯文本                           | 原生菜单（编辑菜单）→ clipboard 读文本 → editor-insert                                                                    |
| `Cmd/Ctrl + Z / Shift+Z`           | Undo / Redo                            | 原生菜单 → editor-undo/redo；CM / Milkdown history                                                                        |
| `Cmd/Ctrl + F`                     | Find & replace                         | 原生菜单 → editor-find → `@codemirror/search`                                                                             |
| `Cmd/Ctrl + =/+ / -`               | Zoom in / out                          | 原生菜单 / `Editor.tsx`                                                                                                   |
| `Cmd/Ctrl + Shift+0`               | Zoom reset（⌘0 已让位「正文」）        | 原生菜单 / `Editor.tsx`                                                                                                   |
| `Cmd/Ctrl + ,`                     | Settings                               | 原生菜单（App/File 菜单）                                                                                                 |
| `Cmd/Ctrl + Shift+B`               | Toggle Sidebar                         | 原生菜单（View 菜单）                                                                                                     |
| `Ctrl+Cmd + 1 / 2`（仅 macOS）     | 侧栏 文件 / 大纲 tab                   | 原生菜单（View 菜单 check 项）                                                                                            |
| `Cmd/Ctrl + Alt+1~4`               | WYSIWYG / Source / Split / Preview     | 原生菜单（View 菜单 check 项）                                                                                            |
| `Cmd/Ctrl + P`                     | Export PDF                             | 原生菜单 / `MoreMenu`                                                                                                     |
| `Escape`                           | Exit edit mode                         | `Editor.tsx`                                                                                                              |

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
  - **数学公式**：remark-math + `math_inline`/`math_block` atom schema + `mathView.ts` 点击编辑，见上文「数学公式 (KaTeX)」。
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
- **insert:\* 动作**：`insertWysiwygSnippet` markdown 解析插入（表格片段复用 `generateTable(2,2)`）；注意 Milkdown 序列化水平分割线为 `***`。
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

### 菜单事件流与状态同步要点

- 完整链路：`src-tauri/src/menu.rs` 构建系统菜单（macOS App/文件/编辑/段落/格式/视图/窗口；Windows/Linux 适配）→ `on_menu_event` 经 `emit_to_focused` 定向 emit `native-menu-event` → 前端 `src/lib/nativeMenu.ts` 的 `handleMenuAction` 分发
- `Menu::get` 只查顶层项；子菜单内的项必须走 lib.rs 的 `find_menu_item` 递归查找
- muda 的 CheckMenuItem 点击会原生自动翻转勾选，最终态以前端同步（`set_menu_item_checked`/`set_menu_item_enabled`）为准
- 菜单重建后所有 check/enabled 回到构建默认值，必须重新同步一轮
- Edit 菜单的 Undo/Redo 用自定义菜单项（系统级 undo 会绕过 CM/Milkdown 的 history）
- `editor-find` 事件：原生菜单 Find → 前端 → `@codemirror/search` 查找替换面板

### macOS Dock 右键菜单（objc2）

- Tauri 2.10 / muda 0.17 / tao 0.34 均无 Dock 菜单 API（仅 `set_dock_visibility`）。实现：setup 时取 `NSApplication.sharedApplication().delegate()`（tao 的 AppDelegate 实例）→ `class_addMethod(applicationDockMenu:, "@@:@")` 注入 IMP，返回全局缓存的 `NSMenu`（`Mutex<Option<Retained<NSMenu>>>`，unsafe Send/Sync 包装，全部主线程访问）。
- 菜单项 target 是 `define_class!` 的 `VividMarkDockMenuTarget`（NSObject 子类，newDocument:/openDocument:/openRecent:/clearRecent:），点击 emit `native-menu-event` **复用前端全部分发**；最近文件路径不经 representedObject（避免 downcast），用 `NSMenuItem.tag` 索引全局路径表。
- 菜单项动作复用 `native-menu-event` 通道，事件 id 为 `file-new` / `file-open` / `open-recent:*` / `clear-recent`（同样经 `emit_to_focused` 定向到焦点窗口）。
- 防御：`class_respondsToSelector` 先检测，tao 未来若自带该方法则跳过不覆盖。**tao/tauri 升级需回归验证此点**。
- 重建：前端 `rebuildMenu` 同订阅点调 `update_dock_menu`（非 macOS 注册 no-op 桩 command）；依赖版本与 tao 0.34 对齐（objc2 0.6 / objc2-app-kit 0.3 / objc2-foundation 0.3），避免双主版本。

### 文件关联（Open With）

- `tauri.conf.json` `bundle.fileAssociations`（md/markdown/mdown/mkd，role=Editor）→ 打包生成 macOS `CFBundleDocumentTypes`（Open With 列表出现，非默认 handler）、Windows 注册表项、Linux mime。**仅打包安装的 .app 生效**（LaunchServices 在安装/首次启动注册），`pnpm tauri:dev` 验证不了。
- 运行时：macOS 双击/打开方式 → `RunEvent::Opened { urls }`（同一运行实例接收，不会另起进程）→ `route_open_paths` 窗口路由（聚焦/复用/新建；冷启动入 main 窗口的启动待打开队列）→ 前端 `src/lib/openWith.ts`；启动积压由 `take_startup_open_files` 命令按窗口 label 补取。Windows/Linux 是拉起新进程传 argv（无 Opened 事件），argv 打开未接（后续项，含单实例）。
- **平台门控坑（v0.2.3 CI 实踩）**：`RunEvent::Opened` 变体本身是 `#[cfg(any(target_os = "macos", target_os = "ios"))]`，Windows/Linux 编译直接 E0599——macOS 本机打包发现不了。事件分支与 `handle_opened_urls` 都需 `#[cfg(target_os = "macos")]` 门控（闭包参数改 `_app/_event` 避免其他平台 unused 警告）。新增平台专属 API 时先在 registry 源码确认其 cfg 条件。

### 2026-08-07 追加修复（右键误触 resize / 视图菜单混淆项）

- **右键触发侧栏调宽**：`useResizable.handleMouseDown` 未检查 `e.button`，右键（button=2）按下也会进入 resize 态（contextmenu 与 mousedown 同序列）——侧栏右缘 4px 热区上右键打开菜单时同时开始调宽。修复：仅 `e.button === 0` 响应。同序问题：分隔条 `title` 硬编码英文 → 走 i18n（`sidebar.dragToResize`）。
- **视图菜单「源代码模式」移除**：⌘/ 切换项与四个视图模式 check 项（所见即所得/源码/分屏/预览）并列引发歧义。Typora 只有双态所以没有这个问题；VividMark 四模式组的显式项已是权威入口。菜单项删除后 ⌘/ 桌面端无 accelerator 占用，keydown 直达 webview 由 `useKeyboardShortcuts` 处理（与改造前行为一致）。
- **WYSIWYG 表格行高虚高**：Milkdown 表格单元格内容被 `<p>` 包裹，`.markdown-body p` 的 1em 段落下边距计入行高（58px vs 预览 47px）。修复：`th/td > p { margin: 0 }`（预览无 p 包裹不受影响），修后 44px。

## 2026-08-13 多窗口（Typora 式 SDI）与菜单重建风暴排查

### 架构要点（window_router.rs / windowManager.ts）

- 每文档独立窗口 = 独立 webview/JS 上下文，单文档 store 无需重构；窗口注册表（`WINDOW_STATES`，前端 `report_window_state` 上报 filePath/isDirty）是「文件→窗口」路由的唯一事实来源
- 菜单/Dock 事件经 `emit_to_focused` 定向 `LAST_FOCUSED`（tauri/muda 菜单事件不携带窗口来源；macOS 菜单点击不改 key window，Windows 点菜单必先聚焦——启发式两端成立）
- 打开路径路由 `route_open_paths`：已打开→聚焦；干净空窗口→复用（定向 `file-open-request`）；否则新建。**新建分支有 pending 去重**（路径已在某新窗口启动队列则跳过）——防前端重复触发竞态建出重复窗口
- 菜单 check/enabled 由焦点窗口驱动（nativeMenu.ts 焦点门控 + `onFocusChanged` 全量重同步）；`rebuildMenu` 按 payload 去重（内容未变不重建）——重建 = Rust 整树菜单 + Dock 菜单 + check/enabled 全量重同步，高频重建即风暴
- `LAST_FOCUSED` 由 `on_window_event` 的 Focused/Destroyed 事件维护
- 新建窗口走 `create_document_window`：macOS 融合标题栏三件套（titleBarStyle/hiddenTitle/trafficLightPosition）在 builder 里用 cfg 门控复制；新建前有 pending 去重，防重复触发建出重复窗口
- capabilities 需配 `windows: ["*"]`（窗口 label 动态生成）
- PDF 导出的隐藏窗口 label（`pdf-export`）排除在打开路由之外

### 坑 1：React StrictMode 异步 cleanup 竞态 → listener 泄漏（关键）

App.tsx 三个 init（initNativeMenu/initOpenWith/initWindowManager）原为「async init → then 里赋值 cleanup」模式。StrictMode 双挂载时第二次 effect 的 cleanup 覆盖第一次的，**首个 listener 永不注销**——每个事件被处理两次。单窗口时代只是幂等浪费；多窗口下 open-recent 双调用 → route 竞态 → **同文件建出两个窗口**。修复：useRef 防重合并为单 effect，不做手动 cleanup（listener 生命周期跟随 webview 上下文，窗口销毁即释放）。**凡「async 注册 + cleanup」的 effect 都有此坑**。

### 坑 2：vite HMR/全量重载 + 幽灵启动队列 = 风暴燃料

新窗口创建时路径入 `STARTUP_OPEN_FILES[label]`，前端就绪后 `take_startup_open_files` 按 label 取走。若页面因 HMR 重载而窗口创建时前端未取走（或泄漏 listener 建出的重复窗口从未正常初始化），队列残留「幽灵条目」——页面每次重载都会把它取走重开文件（lastOpened 刷新 → 菜单重建），反复建窗/重开形成自续循环。修复：热路径收到 `file-open-request` 时 `take_startup_open_files { label: null }` 全清。

### 坑 3：macOS WKWebView 多窗口 localStorage 不共享

实测：多窗口各自独立 localStorage（storage 事件跨窗口不触发）——跨窗口偏好同步不能用 storage 事件，改为 tauri 事件广播（`prefs-sync`，themeMode/language/recentFiles 三字段；listener 值比较落地防回声）。诊断手段备忘：vite dev server 加临时 middleware（POST /\_\_diag 打印请求体）可把 webview 内不可见的 console 信息导入 dev 终端。

### 风暴表现与定位路径

现象：打开多个 md 后 app 主进程 + 各 webview 持续 30–90% CPU（活动监视器），kernel_task 飙升压频。日志表现为同窗口同毫秒数百次 `rebuild_menu`。定位路径：rebuild 调用方 label（命令加 window 参数打 label）→ 前端 DIAG fetch 埋点（发现 openFileByPath 被反复调用、lastOpened 持续刷新）→ take_startup 双窗口取同路径（发现 listener 泄漏双建窗口）→ StrictMode 竞态 + 幽灵队列。

## 2026-08-13 导出为网站（静态站点包）

打开文件夹 → 文件菜单/MoreMenu「导出为网站…」→ 选输出位置 → 生成 `<picked>/<文件夹名>-site/` 可直接部署的静态站点（mkdocs 风格：顶栏 + 左侧可折叠导航 + 浅/深色切换）。零外部依赖（不调 Python/mkdocs CLI）。前端入口 `exportSite.ts` 的 `exportSite()`（选输出目录 → `readDirectory` 原始树 → 渲染 → Rust 批量写盘）；Rust 侧参照 pdf.rs 拆分为 `src-tauri/src/site_export.rs`。

### 关键设计

- **镜像目录结构**：`guide/intro.md` → `guide/intro.html`，非 md 资产按原相对位置原样复制（Rust `export_site` 命令 fs::copy）——图片等相对 src **零重写**即可用，唯一要重写的是 `.md` 互链（换 `.html`，保留 #anchor；README/index 目标映射为 index.html）。这是整个方案的核心简化
- **preserveImages 渲染**：预览用的 image rule 会把本地 src 转 convertFileSrc（asset://），导出站点里是死链。`parseMarkdownAsync(content, { preserveImages: true, inlinePlantUml: true })` 经 markdown-it render 的 env 参数透传到 image rule 跳过转换（不传 baseDir 故 base64 图片内联不触发——那仍是 PDF 单文件场景专用）；`inlinePlantUml` 把 UML 图本地渲染为内联 SVG（2026-08-14 起，此前是 plantuml.com 远程图需联网）
- **导航推导**（siteGenerator.ts，纯函数）：数字前缀 `01-`/`01_`/`01.` 排序且显示名剥离；README.md/index.md 成为所在目录 index.html 且导航恒排最前（回退标题用目录名；根的无 H1 时注入「首页/Home」）；无根 index 页时生成 meta-refresh 重定向首页；纯资产目录不进导航
- **页面框架**（siteTemplate.ts）：共享 CSS 文件 `vividmark-site/site.css` = `collectDocumentCss()`（应用同款 .markdown-body/hljs/主题变量，从 exportPdf.ts 导出复用）+ 框架样式（复用 --editor-bg 等变量，`:root`/`.dark` 双定义随收集 CSS 自动带上）；有公式才 `inlineKatexFonts`；`<html>.dark` 切换 + localStorage `vividmark-site-theme` + head 内联防闪烁脚本；目录折叠用 `<details>/<summary>` 零 JS；附 `.nojekyll` 兼容 GitHub Pages
- **标题 id**：GitHub 风格 slug（Unicode 字母/数字保留、标点剔除、空格转连字符、重名 -1 去重），DOMParser 后处理加到 h1–h6，页内与跨页 `#anchor` 因此可用
- **菜单接线**：`export-site` 菜单项初始禁用，`syncMenuEnabled` 按 `openedFolder` 同步（仿 file-reveal）；handleMenuAction 直接调 `exportSite()`（文件夹级动作不走 editor-\* 事件总线，同 file-open-folder 模式）

### 已知限制（首版接受）

- read_directory 深度上限 10；覆盖写不清理旧文件（重复导出残留已删源文件的 HTML）；无站内搜索/页内 TOC；指向导出集合外 `.md` 的链接同样换后缀（部署后本就失效）

### 配置感知（2026-08-14 P1，`siteConfig.ts`）

- 风味探测优先级：mkdocs > vuepress > plain。根 `mkdocs.yml` → mkdocs 风味，`docs_dir` 收敛导出范围；上一级目录的 mkdocs 配置若 `docs_dir` 指回打开目录也采信；存在 `.vuepress` 目录 → vuepress 风味
- mkdocs 风味的侧边导航 = nav 配置原文（`buildNavFromMkdocsNav`）：策展白名单——不自动追加未收录页面；外链条目新窗口打开；缺文件的条目跳过并记日志
- 标题链：nav > frontmatter > H1 > 文件名；frontmatter 剥离不渲染；导出成功提示带配置来源

---

## 2026-08-13 窗口无法关闭（tauri 2.10 ACL 收紧：allow-destroy 非默认权限）

> 影响版本：0.4.0（macOS）。红灯 / Cmd+W / 文件菜单 Close Window 全部静默无效；黄绿灯正常。

### 症状

用户点红灯无法关闭窗口，Cmd+W 与菜单 Close 同样无效；但通过无障碍（AX）方式触发关闭却正常。安装版 0.4.0 同样复现，排除当时未提交的前端改动。

### 根因链

1. macOS 上用户触发的关闭（红灯 / Cmd+W / 菜单）走 `performClose:` → tao 的 `windowShouldClose:` → 发出 `CloseRequested` 并**返回 NO**（窗口不直接关，交给应用层）。
2. Tauri 发现前端注册了 `onCloseRequested` 监听器（`src/lib/windowManager.ts` 脏确认），于是拦截默认关闭，把 `tauri://close-requested` 事件发给 webview。
3. 前端 handler 判定不脏、不调 `preventDefault` 后，由 `@tauri-apps/api` 的封装执行 `await this.destroy()` 真正销毁窗口（见 `node_modules/@tauri-apps/api/window.js` onCloseRequested 实现）。
4. **tauri 2.10 起 `core:window:allow-destroy` 不再包含在默认权限集**（同批被移出的还有 allow-start-dragging / allow-set-title，之前已踩过），`destroy()` 的 invoke 被 ACL 静默拒绝 → Promise reject 无人处理 → 窗口永远留着。

为什么其他路径都正常，极具迷惑性：

- AX（System Events 点按钮）触发的是更直接的关闭路径，**绕过 `windowShouldClose:`**，不进 JS 门禁 → 能关。
- 黄灯（最小化）/ 绿灯（全屏）不经 `CloseRequested` 门禁 → 正常。
- webview 内点击、菜单栏展开均正常——只有「关闭窗口」这一个动作被门禁吞掉。

### 修复

- `src-tauri/capabilities/default.json` 增加 `core:window:allow-destroy`（与已有的 allow-start-dragging / allow-set-title 并列）。
- 顺带修复文件菜单 Close Window 显示英文：`PredefinedMenuItem::close_window(app, None)` 的默认文案不跟随系统语言（应用 bundle 无本地化 lproj），改为显式传入 `Labels.close_window`（中「关闭窗口」/ 英 "Close Window"）。

### 经验

- **tauri 升级后，凡是前端经 JS API 调用的窗口方法，都要对照 `tauri/permissions/*/autogenerated/reference.md` 的 default 集合逐个数**——ACL 拒绝是完全静默的（invoke reject，无 UI 反馈），症状与「点了没反应」无异。
- 排查「点了没反应」类问题的有效手段：AX 触发（System Events）与合成鼠标事件（CGEvent）对照——AX 走动作直发、合成点击走完整命中链，两者差异能快速切分故障层。注意合成点击对 Tauri 窗口的原生按钮有效（黄灯可触发），对 Finder 也有效，方法本身可信。
- 附带行为确认：经 destroy() 关闭**最后一个**窗口时应用随之退出（Tauri 默认；未接 `RunEvent::ExitRequested`）。当前接受此行为；若日后要 Typora 式「关窗不退出、驻留 Dock」，在 run 回调里拦 ExitRequested + prevent_exit 即可。

---

## 2026-08-14 macOS 红绿灯「先居中、后跳高」（setTitle 触发 AppKit 重置按钮位置）

### 症状

窗口刚创建时红绿灯垂直居中于 48px 工具栏，约 1.8s 后（用户感知为「一会上移了」）按钮跳回 AppKit 默认位置（偏上）。AX 实测按钮中心从 {131,45} 跳到 {128,38}（窗口原点 {120,30}）。

### 根因链

1. `tauri.conf.json` 的 `trafficLightPosition {x:12, y:25.5}` 只在**窗口创建时**由 tao 应用一次，初始居中正确。（tao 语义：标题栏高 = 按钮高 14pt + y，按钮贴容器底部；红绿灯垂直居中公式 y = 目标按钮顶距 + 8.5pt，故 48px 工具栏对应 y = 25.5。）
2. 前端 `Toolbar.tsx` 每次渲染后调 `@tauri-apps/api/window` 的 `setTitle` 同步 Typora 式标题（文件名 ●）。AppKit 的 `setTitle:` 会触发标题栏布局，把 standardWindowButton 重置回默认 frame——trafficLightPosition 的效果被抹掉。
3. tao 0.34.5 的 `inset_traffic_lights` 逻辑只在 `drawRect` 里重放一次 inset，且只调了按钮容器的 frame、不改按钮 y（实测无法自愈）；tauri 没有运行时重排红绿灯的公开 API。

### 修复

新增 `src-tauri/src/titlebar.rs`，导出 `set_window_title` 命令替代前端直调 setTitle：

- `with_webview` 拿到主线程的 NSWindow，先 `setTitle:`，再 `layout_traffic_lights` 显式重排：按钮容器（superview）高 = 按钮高 14pt + 25.5、置顶放置，三个按钮 x = 12 + i×间距、顶距 16pt（经 `convertRect:toView:nil` 换算到容器坐标系，因为标题栏视图是 flipped）。
- 前端 `Toolbar.tsx` 改为 `invoke('set_window_title', { title })`，任何后续 setTitle 都会顺带把红绿灯压回居中位，形成自愈。
- `Cargo.toml` 的 objc2-app-kit 需加 `NSView` feature。

### 经验

- **macOS 上凡是动 NSWindow 原生属性（标题、样式）的调用，都可能触发 AppKit 重排标题栏**，tauri 层的配置只在创建时生效一次，之后要自己在原生源码里重放布局。
- 排查窗口 chrome 布局问题的趁手工具：`osascript` + System Events 读 `position of button N of window 1`（button 1/2/3 = 红/黄/绿），轮询可抓「先对后跳」这类时序问题。
- 同类现象若出现在 Windows/Linux 不适用本条（红绿灯是 macOS 概念；本条代码整体 cfg 门控在 macOS）。

---

## 2026-08-14 PlantUML 本地渲染（@plantuml/core TeaVM 引擎，替代在线服务）

### 选型

- **采用**：官方 `@plantuml/core@1.2026.6`（plantuml/plantuml#2715，TeaVM 编译的纯 JS 引擎；**≥1.2026.6 才是 MIT 许可，更早版本是 GPL**）。plantuml.js 7.15MB + viz-global.js 1.44MB（Graphviz/Viz.js，WASM 已内联 base64，零额外 fetch）+ openiconic.js 51KB；emoji.js（1.88MB，`<:emoji:>` sprite）未打包，需要时后补。
- **排除 CheerpJ 路线**（plantuml/plantuml.js、sakirtemel/plantuml-wasm）：其许可强制要求 Leaning Technologies 云端 runtime，不是真离线。
- **排除 plantuml.jar + JRE**：依赖用户机器装 Java，与「轻量、不依赖外部运行时」的约束冲突。

### 资产与加载

- vite-plugin-static-copy 把 `node_modules/@plantuml/core/{plantuml.js,viz-global.js,openiconic.js,LICENSE}` 拷到 `vendor/plantuml/`（不进 git，版本随 package.json）；dist 体积 5.1MB → ~14MB。
- `src/lib/plantuml.ts` 懒加载：首个 UML 图出现才 `loadScript(viz-global.js) → loadScript(openiconic.js) → import(plantuml.js)`（前两个是 classic script，注册 `window.Viz` / `window.PLANTUML_OPENICONIC` 全局，必须先于渲染；动态 import 用 `/* @vite-ignore */` 绕过打包分析）。

### 引擎行为要点（本机实测 + 官方文档）

- **同一 JS 上下文必须串行渲染**（引擎共享内部状态，并发静默互相覆盖，官方明示）——封装层 Promise 队列强制串行；另有结果缓存（Map，LRU 上限 200）+ inflight 去重。
- `dark` 选项只有 `render(lines, targetId, {dark})` 文档化（renderToString 没有）→ 统一 detached div（离屏绝对定位，**不用 display:none** 以免影响引擎内部测量）+ MutationObserver 等 `<svg>` 出现取 innerHTML，15s 超时 reject。
- 语法错误也会产出「错误示意图」SVG（与在线服务行为一致），reject 只发生在引擎级故障/超时 → 调用方回退 plantuml.com 在线 img（保留旧展示路径，离线环境下与旧版表现相同，不算回归）。
- 引擎需要 canvas 2D 测文本：**jsdom 跑不了**（实测卡在 getContext 超时），单测用 `setPlantUmlEngineForTests` 注入假引擎；真引擎冒烟在 `e2e/plantuml.spec.ts`（Playwright 拦截 plantuml.com 外发请求，证明纯离线渲染）。
- 多窗口各 webview 独立加载引擎副本（内存换隔离，接受）。

### 管线改造

- markdown-it `highlight` 回调必须同步 → fence 与 `@startuml` 行内（parser.ts）只产 `<div class="plantuml-diagram" data-plantuml-src="encodeURIComponent(源码)"><div class="plantuml-loading">` 占位符（顺带消除了 preprocessPlantUML 手拼 URL 的重复实现）。
- 预览（Editor.tsx）：`renderPlantUmlPlaceholders(container, {dark})` DOM 渐进渲染（文本先出、SVG 后补）；占位 div 渲染后保留 data 属性，主题切换按新 dark 重跑即可（SVG 颜色渲染期确定，CSS 变量管不到 SVG 内部）。
- 导出（PDF/站点）：`parseMarkdownAsync` 签名从 `(content, baseDir?)` 改为 `(content, { baseDir?, preserveImages?, inlinePlantUml? })`；`inlinePlantUml: true` 时对 HTML 字符串替换占位符为内联 SVG——PDF 隐藏窗口与导出站点从此零网络依赖（同时修复站点「部署后需联网」的首版限制）。
- WYSIWYG（plantUmlCodeBlockView.ts）：预览+源码双区不变，预览改本地渲染（500ms 防抖 + 渲染序号防陈旧覆盖 + editorStore `isDarkMode` 订阅重渲染，destroy 时取消订阅并递增序号使进行中渲染失效）。
- WYSIWYG 侧裸 `@startuml`（非围栏包裹的行内写法）不做特殊处理。

### 试用回归暴露的两个 bug（当日修复）

- **切换视图模式后图不显示**：预览容器只在 preview/split 模式挂载（Editor.tsx JSX 条件渲染），占位渲染 effect 依赖只有 `[renderedHtml, isDarkMode]`——从 WYSIWYG/Source 切入时容器是新挂载但依赖未变，effect 不重跑，占位符永远停在加载态。首版 e2e 能过纯属 120ms 防抖让 renderedHtml 落在切换之后的时序运气。修复：deps 补 `viewMode`；回归测试「内容就绪后静置再切模式」。**教训：effect 依赖必须覆盖「容器可用性」的来源。**
- **行内正则破坏围栏/行内代码**：`@startuml...@enduml` 行内替换正则不理解 Markdown 结构——围栏代码块里的 plantuml 源码（带标记是常态写法）和行内代码里的 `@startuml` 提及（如语法说明文档）都会被误匹配、嵌套破坏（此问题在在线服务时代就潜伏，测试从未覆盖「围栏内含标记」场景）。修复：替换前 `FENCE_BLOCK_REGEX`（```/~~~ 围栏）+ `INLINE_CODE_REGEX`（单反引号单行 span）掩码代码区，替换后还原（编码进占位符 data 属性前先还原）；未闭合围栏不掩码（罕见用户错误，接受）。

---

## 2026-08-14 SEO 与推广运营笔记

非技术实现，属发布/运营知识，随发布流程一并参考：

- **Search Console 资源 URL 必须填站点根目录**（`https://scottli139.github.io/vividmark/`）；误填 `.../sitemap.xml/` 会导致 HTML 验证文件/meta 无处可放。验证 meta token 全账号通用，重开资源不用换 token。提交 sitemap 后 "Couldn't fetch" 是过渡态，数小时~数天自动转 Success，不用重提。
- **Pages 站点 SEO 件**：`docs/index*.html` 头部（关键词 title/description、OG/Twitter 卡片、JSON-LD SoftwareApplication、中英 hreflang）+ `docs/sitemap.xml`（含 hreflang 注解）+ `docs/robots.txt` + `docs/images/og-image.png`（1200×630，`sips -Z 1200` 后 `-c 630 1200` 从截图裁）。**坑：JSON-LD 里有 `softwareVersion` 字段，发版 bump 三处版本号时需同步这两处。**
- **AlternativeTo**：新注册账号须满 7 天才能 "Suggest new application"（反垃圾）；listing 审核数天~一周；通过后到 Typora/Obsidian/MarkText 等页面 "Suggest alternative" 挂载。外链 dofollow、DR≈80，是 "typora alternative" 搜索词的主要入口。
- **awesome-markdown-editors 2026 新政策**：新条目一律先加 `UPCOMING.md`（不再直接进 README），必须附源码链接；无源码项目进 `COMMERCIAL.md`。
- **Baidu 对 github.io 收录极差**（爬虫基本不抓）。中文流量主渠道是 HelloGitHub（GitHub issue 自荐，人工月刊，选中后 1~2 期刊出）与社区投稿（V2EX/掘金/少数派）；若需 Baidu 收录中文站点，得用 Gitee Pages 或自有域名镜像。

## 2026-08-17 MkDocs `!!!` admonition 双端支持 + exclude_docs（站点导出配置感知 P2）

方案 `docs/site-export-config-plan.md` P2。`!!!`（Python-Markdown 风格）与 `:::` 的关键差异：**无结束围栏，内容范围由「后续 4 空格/tab 缩进的行」决定**（空行悬挂：空行后仍是缩进行则归属容器）。

**预览/分栏（`src/lib/markdown/bangAdmonitionPlugin.ts`）**：自写块级 rule（`md.block.ruler.before('fence')`，alt 同 markdown-it-container 因此可中断段落、可嵌于引用/列表）——不能复用 markdown-it-container（成对围栏定界）。命中标记行后收集缩进内容行（`sCount - blkIndent >= 4` 或空行），dedent 一级（4 空格或 1 tab），`state.md.block.parse` 完整块级解析递归（嵌套 `!!!`、容器内围栏代码块走标准机制）。产出 HTML 与 `:::` 容器逐字节同构（CSS/测试锁定该结构）。**未知类型（mkdocs 扩展类型 abstract/question/...）显示降级 note 主题、默认标题取原类型名**。

**WYSIWYG（文本预处理路线）**：缩进信息到 mdast 层已被 commonmark 抹掉（`!!!` 块变成「标记行融合段落 + 缩进代码块兄弟节点」），故解析不在 remark 变换里做——`src/lib/markdown/bangAdmonition.ts` 的 `preprocessBangAdmonitions` 在 Milkdown 解析前把 `!!!` 缩进块转成**内部 `:::!` 形式**（bang 来源编码），挂在 `WysiwygEditor.tsx` 两个 markdown 入口（`defaultValueCtx` / 两处 `replaceAll`，测试里需手动同款包裹）。admonitionPlugin 的扩展 START_MARKER 识别 `:::!` 后置 PM 节点 `syntax: 'bang'` attr；序列化按 attr 分支输出 `!!! type "title"` + 内容每行 4 空格缩进——**语法保持往返（!!! 进 !!! 出），不归一成 `:::`**（否则会弄坏用户的 mkdocs 构建）。

防坑要点：

- **`:::!` 泄漏防腐**：内部形式只在瞬态文本存在。bang 配对用深度计数（colon 用最近端对齐 markdown-it-container 等长围栏行为）；**内容含 `:::` 标记的 bang 块预处理器直接不转换**（colon 嵌入 bang 的配对会错乱，降级原文优于改写源码）；手写 `:::!` 未配对时整体降级为段落原文。均有测试锁定。
- **预处理器跳过**：围栏代码块内部（跟踪 fence 状态）、`:::` 容器内部整体透传；引用/列表内的 `!!!` 是已知边界（行首有 `>`/列表标记不转换，保持原文不损坏；预览侧经 markdown-it 块级机制正常渲染）。
- **fence 掩码放宽**：parser.ts 的 FENCE_BLOCK_REGEX 缩进从 ` {0,3}` 放宽到 `[ \t]*`——`!!!` 内容整体缩进 4 空格，其内围栏不进掩码会被行内 `@startuml` 正则误替换；掩码在渲染前原样还原，放宽对顶层渲染无影响（顺带修复顶层缩进代码块内 `@startuml` 被误替换的旧边界）。
- **nodeview 未知类型**：class 用 `admonitionDisplayClass`（未知 → note 主题），data attr 与 PM attr 保留原类型名，序列化不丢。
- 标题序列化恒用引号形式（无引号标题首次往返被规范化）；含双引号的标题退回无引号原文。空容器输出仅标记行（`!!! note`）。

**exclude_docs（mkdocs 1.5+，P2.3）**：`parseMkdocsConfig` 解析（官方多行字符串 + 兼容 YAML 数组；剥行内注释/空行）；`compileExcludePatterns`/`isExcludedPath`（siteConfig.ts）实现 .gitignore 语义（`!` 取反最后命中决定、`/` 锚定、`*`/`?` 不跨段、`**` 跨段、尾部 `/` 仅目录）；`filterFileTreeByExcludes`（siteGenerator.ts）在 exportSite 读树后过滤——**页面与资产同滤，路径相对 docs_dir**。这是唯一删减导出内容的配置（nav 只是导航白名单）；nav 指向被排除文件时走既有 missingPaths 跳过 + 日志。mkdocs 隐式默认（`.*`、`/templates/`）未复制：点文件 Rust 侧读目录已跳过，`/templates/` 是 mkdocs 主题概念、对内置生成器无意义。
