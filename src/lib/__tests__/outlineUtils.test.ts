import { describe, it, expect, vi } from 'vitest'
import {
  extractOutline,
  calculateScrollPosition,
  findLineStart,
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

  describe('calculateScrollPosition', () => {
    it('should calculate correct scroll position', () => {
      const content = `Line 1
Line 2
Line 3`
      const charIndex = 14 // Start of "Line 3"

      const scrollPos = calculateScrollPosition(content, charIndex, 24)

      expect(scrollPos).toBe(48) // 2 lines * 24px
    })

    it('should return 0 for start of content', () => {
      const content = `Line 1
Line 2`
      const scrollPos = calculateScrollPosition(content, 0, 24)

      expect(scrollPos).toBe(0)
    })

    it('should handle single line content', () => {
      const content = 'Single line'
      const scrollPos = calculateScrollPosition(content, 5, 24)

      expect(scrollPos).toBe(0)
    })
  })

  describe('findLineStart', () => {
    it('should find start of current line', () => {
      const content = `Line 1
Line 2
Line 3`
      const charIndex = 14 // In "Line 3"

      const lineStart = findLineStart(content, charIndex)

      expect(lineStart).toBe(14) // Start of "Line 3"
      expect(content.slice(lineStart, lineStart + 6)).toBe('Line 3')
    })

    it('should return 0 for first line', () => {
      const content = `Line 1
Line 2`
      const lineStart = findLineStart(content, 3)

      expect(lineStart).toBe(0)
    })

    it('should handle end of content', () => {
      const content = 'Line 1\nLine 2'
      const lineStart = findLineStart(content, content.length)

      expect(content.slice(lineStart)).toBe('Line 2')
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
})
