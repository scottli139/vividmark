import { describe, it, expect, vi } from 'vitest'
import {
  buildOutlineTree,
  extractOutline,
  findActiveOutlineItem,
  scrollPreviewToHeading,
} from '../outlineUtils'

describe('outlineUtils', () => {
  describe('extractOutline', () => {
    it('should extract headings from markdown content', () => {
      const content = `# Heading 1
Some content here.
## Heading 2
More content.
### Heading 3`

      const outline = extractOutline(content)

      expect(outline).toHaveLength(3)
      expect(outline[0]).toEqual({
        level: 1,
        text: 'Heading 1',
        lineIndex: 0,
        charIndex: 0,
        index: 0,
      })
      expect(outline[1]).toEqual({
        level: 2,
        text: 'Heading 2',
        lineIndex: 2,
        charIndex: 31, // "# Heading 1\nSome content here.\n" = 11 + 19 + 1 = 31
        index: 1,
      })
      expect(outline[2]).toEqual({
        level: 3,
        text: 'Heading 3',
        lineIndex: 4,
        charIndex: expect.any(Number),
        index: 2,
      })
    })

    it('should handle empty content', () => {
      const outline = extractOutline('')
      expect(outline).toHaveLength(0)
    })

    it('should handle content without headings', () => {
      const content = `Just some plain text.
More text here.`
      const outline = extractOutline(content)
      expect(outline).toHaveLength(0)
    })

    it('should calculate correct char indices', () => {
      const content = `Line 1
# Heading
Line 3`
      const outline = extractOutline(content)

      expect(outline).toHaveLength(1)
      expect(outline[0].charIndex).toBe(7) // "Line 1\n" = 7 characters
      expect(outline[0].lineIndex).toBe(1)
    })

    it('should handle multiple heading levels', () => {
      const content = `# H1
## H2
### H3
#### H4
##### H5
###### H6`
      const outline = extractOutline(content)

      expect(outline).toHaveLength(6)
      outline.forEach((item, index) => {
        expect(item.level).toBe(index + 1)
        expect(item.text).toBe(`H${index + 1}`)
      })
    })

    it('should handle headings with special characters', () => {
      const content = `# Heading with [link](url)
## Heading with **bold**
### Heading with \`code\``

      const outline = extractOutline(content)

      expect(outline).toHaveLength(3)
      expect(outline[0].text).toBe('Heading with [link](url)')
      expect(outline[1].text).toBe('Heading with **bold**')
      expect(outline[2].text).toBe('Heading with `code`')
    })

    it('should handle multiple consecutive newlines', () => {
      const content = `# Heading 1


## Heading 2`

      const outline = extractOutline(content)

      expect(outline).toHaveLength(2)
      expect(outline[0].text).toBe('Heading 1')
      expect(outline[1].text).toBe('Heading 2')
    })
  })

  describe('scrollPreviewToHeading', () => {
    it('should scroll to the correct heading', () => {
      // Create mock container with headings
      const container = document.createElement('div')
      container.innerHTML = `
        <h1>Heading 1</h1>
        <p>Content</p>
        <h2>Heading 2</h2>
        <p>More content</p>
        <h3>Heading 3</h3>
      `

      // Mock scrollTo
      const scrollToMock = vi.fn()
      container.scrollTo = scrollToMock

      scrollPreviewToHeading(container, 1) // Scroll to second heading (h2)

      expect(scrollToMock).toHaveBeenCalledWith({
        top: expect.any(Number),
        behavior: 'smooth',
      })
    })

    it('should handle invalid index gracefully', () => {
      const container = document.createElement('div')
      container.innerHTML = '<h1>Only one heading</h1>'

      const scrollToMock = vi.fn()
      container.scrollTo = scrollToMock

      scrollPreviewToHeading(container, 99) // Invalid index

      expect(scrollToMock).not.toHaveBeenCalled()
    })

    it('should handle negative index gracefully', () => {
      const container = document.createElement('div')
      container.innerHTML = '<h1>Only one heading</h1>'

      const scrollToMock = vi.fn()
      container.scrollTo = scrollToMock

      scrollPreviewToHeading(container, -1)

      expect(scrollToMock).not.toHaveBeenCalled()
    })
  })

  describe('buildOutlineTree', () => {
    it('should nest deeper items under the nearest ancestor', () => {
      const items = extractOutline('# H1\n\n## H2\n\n### H3\n\n## H2b\n\n# H4')

      const tree = buildOutlineTree(items)

      expect(tree).toHaveLength(2) // H1, H4
      expect(tree[0].text).toBe('H1')
      expect(tree[0].children.map((n) => n.text)).toEqual(['H2', 'H2b'])
      expect(tree[0].children[0].children.map((n) => n.text)).toEqual(['H3'])
      expect(tree[1].text).toBe('H4')
      expect(tree[1].children).toHaveLength(0)
    })

    it('should treat a level jump as nested under the nearest ancestor', () => {
      // ### 直接出现在 # 下（跳过 ##）
      const items = extractOutline('# H1\n\n### H3')

      const tree = buildOutlineTree(items)

      expect(tree).toHaveLength(1)
      expect(tree[0].children).toHaveLength(1)
      expect(tree[0].children[0].text).toBe('H3')
    })

    it('should handle leading non-h1 headings as roots', () => {
      const items = extractOutline('## H2\n\n### H3\n\n## H2b')

      const tree = buildOutlineTree(items)

      expect(tree.map((n) => n.text)).toEqual(['H2', 'H2b'])
      expect(tree[0].children.map((n) => n.text)).toEqual(['H3'])
    })

    it('should return empty array for no headings', () => {
      expect(buildOutlineTree([])).toEqual([])
    })
  })

  describe('findActiveOutlineItem', () => {
    // lines: 0:'# H1', 1:'', 2:'text', 3:'', 4:'## H2', 5:'', 6:'more'
    const items = extractOutline('# H1\n\ntext\n\n## H2\n\nmore')

    it('should return the last heading at or before the cursor line', () => {
      expect(findActiveOutlineItem(items, 7)?.text).toBe('H2')
      expect(findActiveOutlineItem(items, 5)?.text).toBe('H2') // 光标恰在 H2 行
      expect(findActiveOutlineItem(items, 4)?.text).toBe('H1')
      expect(findActiveOutlineItem(items, 1)?.text).toBe('H1')
    })

    it('should return null when cursor is before the first heading', () => {
      const withIntro = extractOutline('intro\n\n# H1')
      expect(findActiveOutlineItem(withIntro, 1)).toBeNull()
    })

    it('should return null for empty outline', () => {
      expect(findActiveOutlineItem([], 10)).toBeNull()
    })
  })
})
