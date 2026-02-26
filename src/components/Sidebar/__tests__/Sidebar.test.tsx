import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from '../Sidebar'
import { useEditorStore } from '../../../stores/editorStore'

// Mock fileOps module
vi.mock('../../../lib/fileOps', () => ({
  openFileByPath: vi.fn(),
}))

// Mock outlineUtils module
vi.mock('../../../lib/outlineUtils', () => ({
  extractOutline: vi.fn((content: string) => {
    // Simple mock implementation
    const lines = content.split('\n')
    const headings: Array<{
      level: number
      text: string
      lineIndex: number
      charIndex: number
      index: number
    }> = []
    let charIndex = 0
    let headingIndex = 0

    lines.forEach((line, lineIndex) => {
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 1
        const text = line.replace(/^#+\s*/, '')
        headings.push({ level, text, lineIndex, charIndex, index: headingIndex++ })
      }
      charIndex += line.length + 1
    })

    return headings
  }),
  scrollToPosition: vi.fn(),
  scrollPreviewToHeading: vi.fn(),
}))

// Import mocked function
import { openFileByPath } from '../../../lib/fileOps'
const mockOpenFileByPath = vi.mocked(openFileByPath)

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state directly
    useEditorStore.setState({
      content: '# Heading 1\n\nSome content\n\n## Heading 2',
      filePath: null,
      fileName: 'test.md',
      isDirty: false,
      recentFiles: [],
      isDarkMode: false,
      showSidebar: true,
      viewMode: 'source',
      activeBlockId: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('visibility', () => {
    it('should render when sidebar is visible', () => {
      render(<Sidebar />)
      expect(screen.getByText('Current File')).toBeInTheDocument()
    })

    it('should not render when sidebar is hidden', () => {
      useEditorStore.getState().toggleSidebar()

      const { container } = render(<Sidebar />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('current file display', () => {
    it('should display current file name', () => {
      render(<Sidebar />)
      expect(screen.getByText('test.md')).toBeInTheDocument()
    })

    it('should show dirty indicator when file has unsaved changes', () => {
      useEditorStore.getState().setDirty(true)
      render(<Sidebar />)

      // Find the current file section and check for the asterisk
      const currentFileSection = screen.getByText('Current File').parentElement
      expect(currentFileSection).toHaveTextContent('*')
    })
  })

  describe('outline extraction', () => {
    it('should display headings from content', () => {
      render(<Sidebar />)

      expect(screen.getByText('Heading 1')).toBeInTheDocument()
      expect(screen.getByText('Heading 2')).toBeInTheDocument()
    })

    it('should show "No headings" when content has no headings', () => {
      useEditorStore.getState().setContent('Just some text without headings.')

      render(<Sidebar />)

      expect(screen.getByText('No headings')).toBeInTheDocument()
    })
  })

  describe('recent files', () => {
    it('should show "No recent files" when list is empty', () => {
      render(<Sidebar />)
      expect(screen.getByText('No recent files')).toBeInTheDocument()
    })

    it('should display recent files', () => {
      useEditorStore.getState().addRecentFile('/path/to/file1.md', 'file1.md')
      useEditorStore.getState().addRecentFile('/path/to/file2.md', 'file2.md')

      render(<Sidebar />)

      expect(screen.getByText('file1.md')).toBeInTheDocument()
      expect(screen.getByText('file2.md')).toBeInTheDocument()
    })

    it('should clear recent files when clear button is clicked', () => {
      useEditorStore.getState().addRecentFile('/path/to/file.md', 'file.md')

      render(<Sidebar />)

      const clearButton = screen.getByText('Clear')
      fireEvent.click(clearButton)

      expect(useEditorStore.getState().recentFiles).toHaveLength(0)
    })

    it('should not show clear button when no recent files', () => {
      render(<Sidebar />)
      expect(screen.queryByText('Clear')).not.toBeInTheDocument()
    })

    it('should open recent file when clicked', async () => {
      mockOpenFileByPath.mockResolvedValue(true)
      useEditorStore.getState().addRecentFile('/path/to/file.md', 'file.md')

      render(<Sidebar />)

      const fileItem = screen.getByText('file.md')
      fireEvent.click(fileItem)

      await waitFor(() => {
        expect(mockOpenFileByPath).toHaveBeenCalledWith('/path/to/file.md')
      })
    })

    it('should confirm before opening recent file when document is dirty', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      mockOpenFileByPath.mockResolvedValue(true)

      useEditorStore.getState().setDirty(true)
      useEditorStore.getState().addRecentFile('/path/to/file.md', 'file.md')

      render(<Sidebar />)

      const fileItem = screen.getByText('file.md')
      fireEvent.click(fileItem)

      expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?')

      confirmSpy.mockRestore()
    })

    it('should not open recent file if user cancels confirmation', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      useEditorStore.getState().setDirty(true)
      useEditorStore.getState().addRecentFile('/path/to/file.md', 'file.md')

      render(<Sidebar />)

      const fileItem = screen.getByText('file.md')
      fireEvent.click(fileItem)

      expect(confirmSpy).toHaveBeenCalled()
      expect(mockOpenFileByPath).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  describe('statistics', () => {
    it('should display character count (no spaces)', () => {
      render(<Sidebar />)

      expect(screen.getByText(/Chars:/)).toBeInTheDocument()
    })

    it('should display total length count', () => {
      render(<Sidebar />)

      expect(screen.getByText(/Words:/)).toBeInTheDocument()
    })

    it('should update statistics when content changes', () => {
      useEditorStore.getState().setContent('One two three four five')

      render(<Sidebar />)

      // New algorithm counts alphanumeric chars (excluding spaces/punctuation)
      // 'Onetwothreefourfive' = 19 chars
      expect(screen.getByText('Chars: 19')).toBeInTheDocument()
    })
  })

  describe('outline navigation', () => {
    it('should dispatch scroll event when heading is clicked', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Sidebar />)

      const heading = screen.getByText('Heading 1')
      fireEvent.click(heading)

      expect(dispatchEventSpy).toHaveBeenCalled()
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent
      expect(event.type).toBe('editor-scroll-to-heading')
      expect(event.detail).toHaveProperty('charIndex')
      expect(event.detail).toHaveProperty('lineIndex')

      dispatchEventSpy.mockRestore()
    })

    it('should dispatch scroll event with correct charIndex for different headings', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      // Content: '# Heading 1\n\nSome content\n\n## Heading 2'
      // Heading 1: charIndex = 0, index = 0
      // Heading 2: charIndex = 27, index = 1
      render(<Sidebar />)

      const heading2 = screen.getByText('Heading 2')
      fireEvent.click(heading2)

      expect(dispatchEventSpy).toHaveBeenCalled()
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent
      expect(event.detail.charIndex).toBe(27)
      expect(event.detail.lineIndex).toBe(4)
      expect(event.detail.index).toBe(1)

      dispatchEventSpy.mockRestore()
    })

    it('should have cursor-pointer style on heading items', () => {
      render(<Sidebar />)

      const heading = screen.getByText('Heading 1')
      expect(heading).toHaveClass('cursor-pointer')
    })

    it('should show title attribute on heading items', () => {
      render(<Sidebar />)

      const heading = screen.getByText('Heading 1')
      expect(heading).toHaveAttribute('title', 'Heading 1')
    })
  })
})
