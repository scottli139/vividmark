import { describe, it, expect } from 'vitest'
import { parseMarkdown, getExcerpt } from '../parser'

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
