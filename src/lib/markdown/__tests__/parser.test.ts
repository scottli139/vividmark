import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from '@tauri-apps/plugin-fs'
import { parseMarkdown, parseMarkdownAsync, getExcerpt, preprocessImages } from '../parser'
import { renderPlantUmlSvg } from '../../plantuml'
import { renderMermaidSvg } from '../../mermaid'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost${path}`),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
}))

// 本地引擎需要 canvas（jsdom 跑不了），mock 渲染函数；在线回退 URL 保留真实实现
vi.mock('../../plantuml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../plantuml')>()
  return { ...actual, renderPlantUmlSvg: vi.fn() }
})

// mermaid 需要布局引擎（jsdom 跑不了），mock 渲染函数
vi.mock('../../mermaid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mermaid')>()
  return { ...actual, renderMermaidSvg: vi.fn() }
})

describe('parseMarkdown', () => {
  it('should parse headings', () => {
    const result = parseMarkdown('# Hello World')
    expect(result).toContain('<h1')
    expect(result).toContain('Hello World')
  })

  it('should parse h2 headings', () => {
    const result = parseMarkdown('## Second Level')
    expect(result).toContain('<h2')
    expect(result).toContain('Second Level')
  })

  it('should parse h3 headings', () => {
    const result = parseMarkdown('### Third Level')
    expect(result).toContain('<h3')
    expect(result).toContain('Third Level')
  })

  it('should parse bold text', () => {
    const result = parseMarkdown('This is **bold** text')
    expect(result).toContain('<strong>')
    expect(result).toContain('bold')
    expect(result).toContain('</strong>')
  })

  it('should parse italic text', () => {
    const result = parseMarkdown('This is *italic* text')
    expect(result).toContain('<em>')
    expect(result).toContain('italic')
    expect(result).toContain('</em>')
  })

  it('should parse inline code', () => {
    const result = parseMarkdown('Use `console.log()` for debugging')
    expect(result).toContain('<code>')
    expect(result).toContain('console.log()')
    expect(result).toContain('</code>')
  })

  it('should parse links', () => {
    const result = parseMarkdown('[Click here](https://example.com)')
    expect(result).toContain('<a href="https://example.com"')
    expect(result).toContain('Click here')
    expect(result).toContain('</a>')
  })

  it('should parse unordered lists', () => {
    const result = parseMarkdown('- Item 1\n- Item 2\n- Item 3')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>')
    expect(result).toContain('Item 1')
    expect(result).toContain('Item 2')
    expect(result).toContain('Item 3')
    expect(result).toContain('</ul>')
  })

  it('should parse blockquotes', () => {
    const result = parseMarkdown('> This is a quote')
    expect(result).toContain('<blockquote>')
    expect(result).toContain('This is a quote')
    expect(result).toContain('</blockquote>')
  })

  it('should parse paragraphs', () => {
    const result = parseMarkdown('This is a paragraph.')
    expect(result).toContain('<p>')
    expect(result).toContain('This is a paragraph.')
    expect(result).toContain('</p>')
  })

  it('should parse code blocks with language', () => {
    const result = parseMarkdown('```javascript\nconst x = 1;\n```')
    expect(result).toContain('<pre class="hljs"')
    expect(result).toContain('<code>')
    expect(result).toContain('const')
    expect(result).toContain('</code>')
    expect(result).toContain('</pre>')
  })

  it('should parse code blocks without language', () => {
    const result = parseMarkdown('```\nplain code\n```')
    expect(result).toContain('<pre class="hljs"')
    // highlight.js auto-detects and wraps in spans, so we check for the words separately
    expect(result).toContain('plain')
    expect(result).toContain('code')
  })

  it('should apply syntax highlighting for known languages', () => {
    const result = parseMarkdown('```typescript\nconst greeting: string = "hello";\n```')
    expect(result).toContain('hljs')
    expect(result).toContain('const')
  })

  it('should handle empty content', () => {
    const result = parseMarkdown('')
    expect(result).toBe('')
  })

  it('should convert line breaks to br tags (breaks option)', () => {
    const result = parseMarkdown('Line 1\nLine 2')
    expect(result).toContain('<br')
  })

  it('should parse multiple elements', () => {
    const markdown = `# Title

This is a paragraph with **bold** and *italic*.

- List item 1
- List item 2

> A quote

\`\`\`javascript
code here
\`\`\`
`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<h1')
    expect(result).toContain('<strong>')
    expect(result).toContain('<em>')
    expect(result).toContain('<ul>')
    expect(result).toContain('<blockquote>')
    expect(result).toContain('<pre class="hljs"')
  })
})

describe('getExcerpt', () => {
  it('should return plain text without markdown syntax', () => {
    const markdown = '# Hello **World**'
    const result = getExcerpt(markdown)
    expect(result).toBe('Hello World')
  })

  it('should remove heading markers', () => {
    const markdown = '## This is a heading'
    const result = getExcerpt(markdown)
    expect(result).toBe('This is a heading')
  })

  it('should remove bold markers', () => {
    const markdown = 'This is **bold** text'
    const result = getExcerpt(markdown)
    expect(result).toBe('This is bold text')
  })

  it('should remove italic markers', () => {
    const markdown = 'This is *italic* text'
    const result = getExcerpt(markdown)
    expect(result).toBe('This is italic text')
  })

  it('should remove inline code markers', () => {
    const markdown = 'Use `code` here'
    const result = getExcerpt(markdown)
    expect(result).toBe('Use code here')
  })

  it('should extract link text', () => {
    const markdown = 'Click [here](https://example.com) for more'
    const result = getExcerpt(markdown)
    expect(result).toBe('Click here for more')
  })

  it('should replace newlines with spaces', () => {
    const markdown = 'Line 1\nLine 2\nLine 3'
    const result = getExcerpt(markdown)
    expect(result).toBe('Line 1 Line 2 Line 3')
  })

  it('should truncate long text with ellipsis', () => {
    const longText = 'a'.repeat(150)
    const result = getExcerpt(longText, 100)
    expect(result).toHaveLength(103) // 100 + '...'
    expect(result.endsWith('...')).toBe(true)
  })

  it('should not truncate short text', () => {
    const shortText = 'Short text'
    const result = getExcerpt(shortText, 100)
    expect(result).toBe('Short text')
  })

  it('should use default maxLength of 100', () => {
    const longText = 'a'.repeat(150)
    const result = getExcerpt(longText)
    expect(result.endsWith('...')).toBe(true)
    expect(result).toHaveLength(103)
  })

  it('should handle empty content', () => {
    const result = getExcerpt('')
    expect(result).toBe('')
  })

  it('should handle complex markdown', () => {
    const markdown = '# Title\n\nThis is **bold** and *italic* with `code` and [link](url).'
    const result = getExcerpt(markdown)
    // Note: newlines become spaces, so there may be extra spaces
    expect(result).toContain('Title')
    expect(result).toContain('bold')
    expect(result).toContain('italic')
    expect(result).toContain('code')
    expect(result).toContain('link')
  })
})

describe('parseMarkdown - image rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock __TAURI__ to be present
    Object.defineProperty(window, '__TAURI__', {
      value: {},
      writable: true,
      configurable: true,
    })
  })

  it('should render image with alt text', () => {
    const markdown = '![alt text](./image.png)'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<img')
    expect(result).toContain('alt="alt text"')
    expect(result).toContain('src=')
  })

  it('should render image with URL', () => {
    const markdown = '![image](https://example.com/img.png)'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<img')
    expect(result).toContain('src="https://example.com/img.png"')
  })

  it('should render image with absolute path in Tauri', () => {
    const markdown = '![photo](/Users/build/photo.jpg)'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<img')
    expect(result).toContain('asset://localhost/Users/build/photo.jpg')
  })

  it('should render image with relative path', () => {
    const markdown = '![image](./assets/pic.png)'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<img')
  })

  it('should render multiple images', () => {
    const markdown = '![first](./1.png) ![second](./2.png)'
    const result = parseMarkdown(markdown)
    expect(result.match(/<img/g)?.length).toBe(2)
  })

  it('should render image without alt text', () => {
    const markdown = '![](./image.png)'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<img')
    expect(result).toContain('alt=""')
  })
})

describe('parseMarkdownAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, '__TAURI__', {
      value: {},
      writable: true,
      configurable: true,
    })
  })

  it('should parse markdown with text content', async () => {
    const markdown = '# Hello World'
    const result = await parseMarkdownAsync(markdown)
    expect(result).toContain('<h1')
    expect(result).toContain('Hello World')
  })

  it('should handle empty content', async () => {
    const result = await parseMarkdownAsync('')
    expect(result).toBe('')
  })

  it('should parse markdown with images', async () => {
    const markdown = '![test](./image.png)'
    const result = await parseMarkdownAsync(markdown)
    expect(result).toContain('<img')
    expect(result).toContain('alt="test"')
  })

  it('preserveImages 跳过 base64 预处理，相对 src 原样保留（站点导出）', async () => {
    const mockedReadFile = vi.mocked(readFile)
    mockedReadFile.mockClear()
    const result = await parseMarkdownAsync('![test](./image.png)', { preserveImages: true })
    expect(result).toContain('src="./image.png"')
    // base64 内联是 PDF 单文件场景；站点导出资产镜像复制，不应读盘转 base64
    expect(mockedReadFile).not.toHaveBeenCalled()
  })

  it('should handle content without images', async () => {
    const markdown = '# Title\n\nSome text here.'
    const result = await parseMarkdownAsync(markdown)
    expect(result).toContain('<h1')
    expect(result).toContain('<p>')
  })
})

describe('preprocessImages', () => {
  it('should return content unchanged when no images', async () => {
    const content = '# Hello World\n\nJust some text.'
    const result = await preprocessImages(content)
    expect(result).toBe(content)
  })

  it('should skip HTTP URLs', async () => {
    const content = '![image](https://example.com/img.png)'
    const result = await preprocessImages(content)
    expect(result).toBe(content)
  })

  it('should skip data URLs', async () => {
    const content = '![image](data:image/png;base64,abc123)'
    const result = await preprocessImages(content)
    expect(result).toBe(content)
  })

  it('should convert bare relative paths (images/x.png) against baseDir', async () => {
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const mockReadFile = vi.mocked(readFile)
    mockReadFile.mockResolvedValue(new Uint8Array([137, 80, 78, 71]))

    const content = '![wiring](images/dht11_wiring.png)'
    const result = await preprocessImages(content, '/docs')

    expect(mockReadFile).toHaveBeenCalledWith('/docs/images/dht11_wiring.png')
    expect(result).toContain('data:image/png;base64,')
    expect(result).not.toContain('images/dht11_wiring.png')
  })
})

describe('parseMarkdown - Admonitions', () => {
  it('should render tip admonition', () => {
    const markdown = `::: tip
This is a tip.
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition tip">')
    expect(result).toContain('<div class="admonition-title">Tip</div>')
    expect(result).toContain('<div class="admonition-content">')
    expect(result).toContain('<p>This is a tip.</p>')
    expect(result).toContain('</div></div>')
  })

  it('should render tip admonition with custom title', () => {
    const markdown = `::: tip 注意
This is a tip with custom title.
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition tip">')
    expect(result).toContain('<div class="admonition-title">注意</div>')
    expect(result).toContain('This is a tip with custom title.')
  })

  it('should render warning admonition', () => {
    const markdown = `::: warning
This is a warning.
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition warning">')
    expect(result).toContain('<div class="admonition-title">Warning</div>')
    expect(result).toContain('This is a warning.')
  })

  it('should render warning admonition with custom title', () => {
    const markdown = `::: warning 开发工具
Please use the correct tools.
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition warning">')
    expect(result).toContain('<div class="admonition-title">开发工具</div>')
    expect(result).toContain('Please use the correct tools.')
  })

  it('should render info admonition', () => {
    const markdown = `::: info
This is information.
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition info">')
    expect(result).toContain('This is information.')
  })

  it('should render note admonition', () => {
    const markdown = `::: note
This is a note.
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition note">')
    expect(result).toContain('This is a note.')
  })

  it('should render danger admonition', () => {
    const markdown = `::: danger
This is dangerous!
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition danger">')
    expect(result).toContain('This is dangerous!')
  })

  it('should render success admonition', () => {
    const markdown = `::: success
Operation completed successfully!
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition success">')
    expect(result).toContain('Operation completed successfully!')
  })

  it('should render admonition with markdown content', () => {
    const markdown = `::: tip
This is a **bold** tip with \`code\`.
:::`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="admonition tip">')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<code>code</code>')
  })

  it('should render multiple admonitions', () => {
    const markdown = `::: tip
Tip 1
:::

::: warning
Warning 1
:::`
    const result = parseMarkdown(markdown)
    expect(result.match(/<div class="admonition (tip|warning)/g)?.length).toBe(2)
    expect(result).toContain('Tip 1')
    expect(result).toContain('Warning 1')
  })
})

describe('parseMarkdown - PlantUML', () => {
  /** 占位符 data 属性里解码出的 PlantUML 源码 */
  function placeholderSrc(html: string): string {
    const src = html.match(/data-plantuml-src="([^"]*)"/)?.[1]
    return decodeURIComponent(src ?? '')
  }

  it('should render inline PlantUML as placeholder', () => {
    const markdown = `@startuml
Alice -> Bob: Hello
@enduml`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="plantuml-diagram" data-plantuml-src="')
    expect(result).toContain('<div class="plantuml-loading"></div>')
    // 完整 @startuml...@enduml 源码进占位符，本地引擎渲染时取回
    expect(placeholderSrc(result)).toContain('@startuml')
    expect(placeholderSrc(result)).toContain('Alice -> Bob: Hello')
    expect(placeholderSrc(result)).toContain('@enduml')
  })

  it('should render PlantUML code block as placeholder', () => {
    const markdown = '```plantuml\nAlice -> Bob: Hello\n```'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="plantuml-diagram" data-plantuml-src="')
    expect(placeholderSrc(result)).toContain('Alice -> Bob: Hello')
  })

  it('should not wrap diagram placeholder in pre/code', () => {
    // 图表占位符不是代码：pre 的等宽字体 !important 规则会压进 SVG，与引擎量尺寸
    // 所用字体不一致导致文字裁断（曾有的 bug）
    const result = parseMarkdown('```plantuml\nAlice -> Bob\n```')
    expect(result.startsWith('<div class="plantuml-diagram"')).toBe(true)
    expect(result).not.toContain('<pre')
  })

  it('should render multiple PlantUML diagrams', () => {
    const markdown = `@startuml
Alice -> Bob: Hello
@enduml

@startuml
Bob -> Charlie: Hi
@enduml`
    const result = parseMarkdown(markdown)
    expect(result.match(/plantuml-diagram/g)?.length).toBe(2)
    expect(result.match(/plantuml-loading/g)?.length).toBe(2)
  })

  it('should handle PlantUML with complex content', () => {
    const markdown = `@startuml
start
if (condition) then (yes)
  :action1;
else (no)
  :action2;
endif
stop
@enduml`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="plantuml-diagram" data-plantuml-src="')
    expect(placeholderSrc(result)).toContain('if (condition) then (yes)')
  })

  it('should not mangle fenced code blocks containing @startuml markers', () => {
    // 围栏里的标记是 plantuml 代码块的常态写法，行内正则不得入内（曾有的嵌套破坏 bug）
    const markdown = '```plantuml\n@startuml\nA -> B\n@enduml\n```'
    const result = parseMarkdown(markdown)
    expect(result.match(/plantuml-diagram/g)?.length).toBe(1)
    expect(placeholderSrc(result)).toBe('@startuml\nA -> B\n@enduml\n')
  })

  it('should not match @startuml inside inline code spans', () => {
    const markdown = '`@startuml` 与 `@enduml` 标记必须书写'
    const result = parseMarkdown(markdown)
    expect(result).not.toContain('plantuml-diagram')
    expect(result).toContain('<code>@startuml</code>')
    expect(result).toContain('<code>@enduml</code>')
  })

  it('should render fenced and inline forms side by side correctly', () => {
    const markdown = '```plantuml\n@startuml\nA -> B\n@enduml\n```\n\n@startuml\nC -> D\n@enduml'
    const result = parseMarkdown(markdown)
    const sources = [...result.matchAll(/data-plantuml-src="([^"]*)"/g)].map((m) =>
      decodeURIComponent(m[1])
    )
    expect(sources.length).toBe(2)
    expect(sources[0]).toBe('@startuml\nA -> B\n@enduml\n')
    expect(sources[1]).toBe('@startuml\nC -> D\n@enduml')
  })
})

describe('parseMarkdownAsync - Admonitions and PlantUML', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, '__TAURI__', {
      value: {},
      writable: true,
      configurable: true,
    })
  })

  it('should render admonitions in async mode', async () => {
    const markdown = `::: tip
Async tip
:::`
    const result = await parseMarkdownAsync(markdown)
    expect(result).toContain('<div class="admonition tip">')
    expect(result).toContain('Async tip')
  })

  it('should render PlantUML placeholder in async mode', async () => {
    const markdown = `@startuml
Alice -> Bob: Async
@enduml`
    const result = await parseMarkdownAsync(markdown)
    expect(result).toContain('<div class="plantuml-diagram" data-plantuml-src="')
    expect(result).toContain('<div class="plantuml-loading"></div>')
  })

  it('should inline PlantUML SVG when inlinePlantUml is set', async () => {
    vi.mocked(renderPlantUmlSvg).mockResolvedValue('<svg data-test="local"></svg>')
    const markdown = `@startuml
Alice -> Bob: Inline
@enduml`
    const result = await parseMarkdownAsync(markdown, { inlinePlantUml: true })
    expect(renderPlantUmlSvg).toHaveBeenCalledOnce()
    expect(result).toContain('<div class="plantuml-diagram"><svg data-test="local"></svg></div>')
    expect(result).not.toContain('plantuml-loading')
    expect(result).not.toContain('data-plantuml-src')
  })

  it('should fall back to online service when local render fails', async () => {
    vi.mocked(renderPlantUmlSvg).mockRejectedValue(new Error('engine unavailable'))
    const markdown = `@startuml
Alice -> Bob: Fallback
@enduml`
    const result = await parseMarkdownAsync(markdown, { inlinePlantUml: true })
    expect(result).toContain('plantuml.com/plantuml/svg')
    expect(result).toContain('<img')
  })
})

describe('parseMarkdown - Mermaid', () => {
  /** 占位符 data 属性里解码出的 Mermaid 源码 */
  function placeholderSrc(html: string): string {
    const src = html.match(/data-mermaid-src="([^"]*)"/)?.[1]
    return decodeURIComponent(src ?? '')
  }

  it('should render mermaid code block as placeholder', () => {
    const markdown = '```mermaid\ngraph TD; A-->B\n```'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="mermaid-diagram" data-mermaid-src="')
    expect(result).toContain('<div class="mermaid-loading"></div>')
    expect(placeholderSrc(result)).toContain('graph TD; A-->B')
  })

  it('should not wrap mermaid placeholder in pre/code', () => {
    // 图表占位符不是代码：pre 的等宽字体 !important 规则会穿透 mermaid 注入的字体样式，
    // foreignObject 文字按更宽的等宽字体渲染、按 mermaid 配置字体测量 → 文字被裁断
    const result = parseMarkdown('```mermaid\ngraph TD; A-->B\n```')
    expect(result.startsWith('<div class="mermaid-diagram"')).toBe(true)
    expect(result).not.toContain('<pre')
  })

  it('should render multiple mermaid diagrams', () => {
    const markdown =
      '```mermaid\ngraph TD; A-->B\n```\n\n```mermaid\nsequenceDiagram; A->>B: hi\n```'
    const result = parseMarkdown(markdown)
    expect(result.match(/mermaid-diagram/g)?.length).toBe(2)
    expect(result.match(/mermaid-loading/g)?.length).toBe(2)
  })

  it('should not affect other code blocks mentioning mermaid', () => {
    const markdown = '```text\n用 ```mermaid 围栏画图\n```'
    const result = parseMarkdown(markdown)
    expect(result).not.toContain('mermaid-diagram')
  })

  it('should inline Mermaid SVG when inlineMermaid is set', async () => {
    vi.mocked(renderMermaidSvg).mockResolvedValue('<svg data-test="mermaid"></svg>')
    const markdown = '```mermaid\ngraph TD; A-->B\n```'
    const result = await parseMarkdownAsync(markdown, { inlineMermaid: true })
    expect(renderMermaidSvg).toHaveBeenCalledOnce()
    expect(result).toContain('<div class="mermaid-diagram"><svg data-test="mermaid"></svg></div>')
    expect(result).not.toContain('mermaid-loading')
    expect(result).not.toContain('data-mermaid-src')
  })

  it('should show error state when mermaid render fails', async () => {
    // 语法错误等渲染失败：无在线服务可回退，展示错误原因 + 源码 + 错误样式
    vi.mocked(renderMermaidSvg).mockRejectedValue(new Error('Parse error on line 1'))
    const markdown = '```mermaid\nnot a diagram\n```'
    const result = await parseMarkdownAsync(markdown, { inlineMermaid: true })
    expect(result).toContain('mermaid-error')
    expect(result).toContain('not a diagram')
    expect(result).toContain('mermaid-error-message')
    expect(result).toContain('Parse error on line 1')
  })
})

describe('parseMarkdown - Task Lists', () => {
  it('should render unchecked task item', () => {
    const markdown = '- [ ] Unchecked task'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<li')
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('<input type="checkbox"')
    expect(result).toContain('<span class="task-content">')
    expect(result).toContain('Unchecked task')
    // 检查 checkbox 没有 checked 属性（但可能包含 data-task-status="unchecked"）
    const checkboxMatch = result.match(/<input[^>]*type="checkbox"[^>]*>/)
    expect(checkboxMatch).toBeTruthy()
    // 精确检查：不是 data-task-status 中的 checked，而是 checked 属性
    expect(checkboxMatch![0]).not.toMatch(/\schecked[\s>]/) // 匹配 " checked" 或 "checked>"，但不匹配 data-task-status="unchecked"
  })

  it('should render checked task item with [x]', () => {
    const markdown = '- [x] Checked task'
    const result = parseMarkdown(markdown)
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('<input type="checkbox"')
    expect(result).toContain('checked')
    expect(result).toContain('<span class="task-content">')
    expect(result).toContain('Checked task')
  })

  it('should render checked task item with [X]', () => {
    const markdown = '- [X] Checked task with capital X'
    const result = parseMarkdown(markdown)
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('checked')
    expect(result).toContain('<span class="task-content">')
    expect(result).toContain('Checked task with capital X')
  })

  it('should render multiple task items', () => {
    const markdown = `- [ ] Task 1
- [x] Task 2
- [ ] Task 3`
    const result = parseMarkdown(markdown)
    expect(result.match(/task-list-item/g)?.length).toBe(3)
    expect(result.match(/<input[^>]*type="checkbox"/g)?.length).toBe(3)
  })

  it('should render task list with asterisk marker', () => {
    const markdown = '* [ ] Asterisk task'
    const result = parseMarkdown(markdown)
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('<span class="task-content">')
    expect(result).toContain('Asterisk task')
  })

  it('should render mixed normal and task list items', () => {
    const markdown = `- Normal item
- [ ] Task item
- Another normal`
    const result = parseMarkdown(markdown)
    // 应该有一个任务列表项
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('<span class="task-content">')
    // 普通列表项不应该有 task-list-item 类
    expect(result).toContain('Normal item')
    expect(result).toContain('Another normal')
    expect(result).toContain('Task item')
  })

  it('should add data-task-index attribute', () => {
    const markdown = '- [ ] First task'
    const result = parseMarkdown(markdown)
    expect(result).toContain('data-task-index="0"')
    expect(result).toContain('<span class="task-content">')
  })

  it('should handle task items with markdown formatting', () => {
    const markdown = '- [ ] Task with **bold** text'
    const result = parseMarkdown(markdown)
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('<span class="task-content">')
    expect(result).toContain('<strong>bold</strong>')
  })

  it('should handle task items with links', () => {
    const markdown = '- [ ] Task with [link](https://example.com)'
    const result = parseMarkdown(markdown)
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('<span class="task-content">')
    expect(result).toContain('<a href="https://example.com">')
  })

  it('should handle empty task description', () => {
    const markdown = '- [ ] '
    const result = parseMarkdown(markdown)
    expect(result).toContain('class="task-list-item"')
    expect(result).toContain('<span class="task-content">')
    expect(result).toContain('<input type="checkbox"')
  })

  it('should not treat regular brackets as task list', () => {
    const markdown = '- [not a task] Regular item'
    const result = parseMarkdown(markdown)
    // 不应该被识别为任务列表项
    expect(result).not.toContain('task-list-item')
    expect(result).not.toContain('task-checkbox')
    expect(result).toContain('[not a task]')
  })
})

// ==================== frontmatter 剥离 ====================

describe('frontmatter 剥离', () => {
  it('剥离文档开头的 YAML frontmatter，正文正常渲染', () => {
    const markdown = '---\ntitle: 指南\ndraft: false\n---\n# 正文标题\n内容'
    const result = parseMarkdown(markdown)
    // frontmatter 不渲染（不出现 --- 分隔线 / title 文本）
    expect(result).not.toContain('<hr')
    expect(result).not.toContain('title')
    expect(result).not.toContain('draft')
    // 正文不受影响
    expect(result).toContain('<h1')
    expect(result).toContain('正文标题')
  })

  it('整篇仅 frontmatter 时渲染为空', () => {
    const result = parseMarkdown('---\ntitle: only\n---\n')
    expect(result).not.toContain('title')
    expect(result).not.toContain('<hr')
  })

  it('YAML 解析失败时保守保留原文（不剥离）', () => {
    const markdown = '---\ntitle: [unclosed\n---\n# 标题'
    const result = parseMarkdown(markdown)
    // 未剥离：开头 --- 渲染为分割线，frontmatter 内容按正文渲染
    expect(result).toContain('<hr')
  })

  it('文档中间的 --- 不是 frontmatter（仍是分割线）', () => {
    const markdown = '第一段\n\n---\n\ntitle: 不是 frontmatter'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<hr')
    expect(result).toContain('title: 不是 frontmatter')
  })

  it('frontmatter 前面有内容（非文档开头）不剥离', () => {
    const markdown = '\n---\ntitle: x\n---\n正文'
    const result = parseMarkdown(markdown)
    expect(result).toContain('title')
  })

  it('无闭合 --- 围栏按正文处理', () => {
    const markdown = '---\ntitle: x\n# 标题'
    const result = parseMarkdown(markdown)
    expect(result).toContain('title')
  })

  it('frontmatter 内的任务列表语法不影响正文任务索引', () => {
    const markdown = '---\ntitle: "- [ ] 不是任务"\n---\n- [ ] 真任务'
    const result = parseMarkdown(markdown)
    // 正文任务从 index 0 开始（frontmatter 内的 - [ ] 已被剥离，不占索引）
    expect(result).toContain('data-task-index="0"')
    expect(result).not.toContain('不是任务')
  })

  it('parseMarkdownAsync 同样剥离 frontmatter', async () => {
    const markdown = '---\ntitle: 指南\n---\n# 正文标题'
    const result = await parseMarkdownAsync(markdown)
    expect(result).not.toContain('title')
    expect(result).toContain('<h1')
    expect(result).toContain('正文标题')
  })
})

describe('parseMarkdown - 排版增强（==mark== / ^sup^ / ~sub~ / emoji）', () => {
  it('==高亮== 渲染为 <mark>', () => {
    expect(parseMarkdown('这是 ==高亮内容== 文字')).toContain('<mark>高亮内容</mark>')
  })

  it('^上标^ 渲染为 <sup>', () => {
    expect(parseMarkdown('E = mc^2^')).toContain('mc<sup>2</sup>')
  })

  it('~下标~ 渲染为 <sub>，与 ~~ 删除线无冲突', () => {
    const result = parseMarkdown('H~2~O 与 ~~删除~~')
    expect(result).toContain('H<sub>2</sub>O')
    expect(result).toContain('<s>删除</s>')
  })

  it('emoji 短码渲染为 unicode 字符', () => {
    const result = parseMarkdown('笑脸 :smile:')
    expect(result).toContain('😄')
    expect(result).not.toContain(':smile:')
  })

  it('代码区内不处理（emoji 与分隔符保持字面）', () => {
    const result = parseMarkdown('`:smile:` 与 `==x==` 与 `~y~`')
    expect(result).toContain('<code>:smile:</code>')
    expect(result).toContain('<code>==x==</code>')
    expect(result).toContain('<code>~y~</code>')
  })

  it('嵌套行内格式（==**加粗**==）', () => {
    const result = parseMarkdown('==含 **加粗**==')
    expect(result).toContain('<mark>含 <strong>加粗</strong></mark>')
  })

  it('字内配对（H~2~O / a==b==c）', () => {
    const result = parseMarkdown('H~2~O 与 a==b==c')
    expect(result).toContain('H<sub>2</sub>O')
    expect(result).toContain('a<mark>b</mark>c')
  })

  it('空白相邻不配对（降级字面文本）', () => {
    const result = parseMarkdown('== x ==')
    expect(result).not.toContain('<mark>')
  })
})
