import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTextFormat } from '../useTextFormat'

describe('useTextFormat', () => {
  const { result } = renderHook(() => useTextFormat())
  const { formatText, toggleBlockPrefix } = result.current

  describe('formatText', () => {
    describe('with text selection', () => {
      it('should wrap selected text with bold markers', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'bold', selection)

        expect(result.text).toBe('**Hello** World')
        expect(result.cursorPos).toBe(9)
      })

      it('should wrap selected text with italic markers', () => {
        const text = 'Hello World'
        const selection = { start: 6, end: 11 }
        const result = formatText(text, 'italic', selection)

        expect(result.text).toBe('Hello *World*')
        expect(result.cursorPos).toBe(13)
      })

      it('should wrap selected text with strikethrough markers', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'strike', selection)

        expect(result.text).toBe('~~Hello~~ World')
      })

      it('should wrap selected text with inline code markers', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'code', selection)

        expect(result.text).toBe('`Hello` World')
      })

      it('should wrap selected text with link markers', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'link', selection)

        expect(result.text).toBe('[Hello](url) World')
      })

      it('should add heading prefix to selected text', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'h1', selection)

        expect(result.text).toBe('# Hello World')
      })

      it('should add quote prefix to selected text', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'quote', selection)

        expect(result.text).toBe('> Hello World')
      })

      it('should add list prefix to selected text', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'list', selection)

        expect(result.text).toBe('- Hello World')
      })

      it('should wrap selected text with code block markers', () => {
        const text = 'Hello World'
        const selection = { start: 0, end: 5 }
        const result = formatText(text, 'codeblock', selection)

        expect(result.text).toBe('```\nHello\n``` World')
      })
    })

    describe('without text selection', () => {
      it('should insert bold placeholder at cursor position', () => {
        const text = 'Hello World'
        const selection = { start: 5, end: 5 }
        const result = formatText(text, 'bold', selection)

        expect(result.text).toBe('Hello**bold text** World')
        expect(result.cursorPos).toBe(7) // After prefix
        expect(result.selectLength).toBe(9) // Length of 'bold text'
      })

      it('should insert italic placeholder at cursor position', () => {
        const text = 'Hello'
        const selection = { start: 5, end: 5 }
        const result = formatText(text, 'italic', selection)

        expect(result.text).toBe('Hello*italic text*')
        expect(result.selectLength).toBe(11)
      })

      it('should insert code block placeholder at cursor position', () => {
        const text = ''
        const selection = { start: 0, end: 0 }
        const result = formatText(text, 'codeblock', selection)

        expect(result.text).toBe('```\ncode here\n```')
      })

      it('should insert link placeholder with URL placeholder', () => {
        const text = 'Hello'
        const selection = { start: 5, end: 5 }
        const result = formatText(text, 'link', selection)

        expect(result.text).toBe('Hello[link text](url)')
      })

      it('should append at end when no selection position provided', () => {
        const text = 'Hello'
        const result = formatText(text, 'bold')

        expect(result.text).toBe('Hello**bold text**')
      })
    })
  })

  describe('toggleBlockPrefix', () => {
    it('should add h1 prefix to line without prefix', () => {
      const text = 'Hello World'
      const result = toggleBlockPrefix(text, 'h1')

      expect(result).toBe('# Hello World')
    })

    it('should remove h1 prefix when already present', () => {
      const text = '# Hello World'
      const result = toggleBlockPrefix(text, 'h1')

      expect(result).toBe('Hello World')
    })

    it('should switch from h1 to h2', () => {
      const text = '# Hello World'
      const result = toggleBlockPrefix(text, 'h2')

      expect(result).toBe('## Hello World')
    })

    it('should switch from h2 to h3', () => {
      const text = '## Hello World'
      const result = toggleBlockPrefix(text, 'h3')

      expect(result).toBe('### Hello World')
    })

    it('should switch from h3 to h1', () => {
      const text = '### Hello World'
      const result = toggleBlockPrefix(text, 'h1')

      expect(result).toBe('# Hello World')
    })

    it('should switch from quote to h1', () => {
      const text = '> Hello World'
      const result = toggleBlockPrefix(text, 'h1')

      expect(result).toBe('# Hello World')
    })

    it('should switch from list to h1', () => {
      const text = '- Hello World'
      const result = toggleBlockPrefix(text, 'h1')

      expect(result).toBe('# Hello World')
    })

    it('should add quote prefix to line without prefix', () => {
      const text = 'Hello World'
      const result = toggleBlockPrefix(text, 'quote')

      expect(result).toBe('> Hello World')
    })

    it('should add list prefix to line without prefix', () => {
      const text = 'Hello World'
      const result = toggleBlockPrefix(text, 'list')

      expect(result).toBe('- Hello World')
    })

    it('should remove quote prefix when already present', () => {
      const text = '> Hello World'
      const result = toggleBlockPrefix(text, 'quote')

      expect(result).toBe('Hello World')
    })

    it('should handle multiline text (only first line affected)', () => {
      const text = 'Hello\nWorld'
      const result = toggleBlockPrefix(text, 'h1')

      expect(result).toBe('# Hello\nWorld')
    })
  })
})
