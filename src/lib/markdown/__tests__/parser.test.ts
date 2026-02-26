import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseMarkdown, parseMarkdownAsync, getExcerpt, preprocessImages } from '../parser'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost${path}`),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
}))

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
  it('should render inline PlantUML as image', () => {
    const markdown = `@startuml
Alice -> Bob: Hello
@enduml`
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="plantuml-diagram">')
    expect(result).toContain('<img')
    expect(result).toContain('plantuml.com/plantuml/svg')
    expect(result).toContain('loading="lazy"')
  })

  it('should render PlantUML code block as image', () => {
    const markdown = '```plantuml\nAlice -> Bob: Hello\n```'
    const result = parseMarkdown(markdown)
    expect(result).toContain('<div class="plantuml-diagram">')
    expect(result).toContain('<img')
    expect(result).toContain('plantuml.com/plantuml/svg')
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
    expect(result).toContain('<div class="plantuml-diagram">')
    expect(result).toContain('plantuml.com/plantuml/svg')
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

  it('should render PlantUML in async mode', async () => {
    const markdown = `@startuml
Alice -> Bob: Async
@enduml`
    const result = await parseMarkdownAsync(markdown)
    expect(result).toContain('<div class="plantuml-diagram">')
    expect(result).toContain('plantuml.com/plantuml/svg')
  })
})
