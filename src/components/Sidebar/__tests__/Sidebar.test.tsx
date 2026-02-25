import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from '../Sidebar'
import { useEditorStore } from '../../../stores/editorStore'

// Mock fileOps module
vi.mock('../../../lib/fileOps', () => ({
  openFileByPath: vi.fn(),
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
      viewMode: 'edit',
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
    it('should display word count', () => {
      render(<Sidebar />)

      expect(screen.getByText(/Words:/)).toBeInTheDocument()
    })

    it('should display character count', () => {
      render(<Sidebar />)

      expect(screen.getByText(/Chars:/)).toBeInTheDocument()
    })

    it('should update statistics when content changes', () => {
      useEditorStore.getState().setContent('One two three four five')

      render(<Sidebar />)

      expect(screen.getByText('Words: 5')).toBeInTheDocument()
    })
  })
})
