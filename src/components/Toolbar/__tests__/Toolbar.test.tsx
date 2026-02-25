import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Toolbar } from '../Toolbar'
import { useEditorStore } from '../../../stores/editorStore'

// Mock fileOps module
vi.mock('../../../lib/fileOps', () => ({
  openFile: vi.fn(),
  saveFile: vi.fn(),
  newFile: vi.fn(),
}))

// Import mocked functions
import { openFile, saveFile, newFile } from '../../../lib/fileOps'
const mockOpenFile = vi.mocked(openFile)
const mockSaveFile = vi.mocked(saveFile)
const mockNewFile = vi.mocked(newFile)

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state directly
    useEditorStore.setState({
      content: '',
      filePath: null,
      fileName: 'Untitled.md',
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

  describe('rendering', () => {
    it('should render file name', () => {
      render(<Toolbar />)
      expect(screen.getByText('Untitled.md')).toBeInTheDocument()
    })

    it('should show dirty indicator when document has unsaved changes', () => {
      useEditorStore.getState().setDirty(true)
      render(<Toolbar />)

      // The asterisk should be visible - find it by looking for text containing * near the filename
      const fileNameContainer = screen.getByText('Untitled.md').parentElement
      expect(fileNameContainer).toHaveTextContent('*')
    })

    it('should display custom file name', () => {
      useEditorStore.getState().setFileName('MyDocument.md')
      render(<Toolbar />)
      expect(screen.getByText('MyDocument.md')).toBeInTheDocument()
    })
  })

  describe('file operations', () => {
    it('should call openFile when open button is clicked', async () => {
      mockOpenFile.mockResolvedValue(undefined)
      render(<Toolbar />)

      const openButton = screen.getByTitle('Open File (Cmd+O)')
      fireEvent.click(openButton)

      await waitFor(() => {
        expect(mockOpenFile).toHaveBeenCalledTimes(1)
      })
    })

    it('should call saveFile when save button is clicked', async () => {
      mockSaveFile.mockResolvedValue(true)
      render(<Toolbar />)

      const saveButton = screen.getByTitle('Save (Cmd+S)')
      fireEvent.click(saveButton)

      await waitFor(() => {
        expect(mockSaveFile).toHaveBeenCalledTimes(1)
      })
    })

    it('should call newFile when new button is clicked and document is clean', () => {
      render(<Toolbar />)

      const newButton = screen.getByTitle('New File (Cmd+N)')
      fireEvent.click(newButton)

      expect(mockNewFile).toHaveBeenCalledTimes(1)
    })

    it('should confirm before creating new file when document is dirty', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      useEditorStore.getState().setDirty(true)
      render(<Toolbar />)

      const newButton = screen.getByTitle('New File (Cmd+N)')
      fireEvent.click(newButton)

      expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?')
      expect(mockNewFile).toHaveBeenCalledTimes(1)

      confirmSpy.mockRestore()
    })

    it('should not create new file if user cancels confirmation', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      useEditorStore.getState().setDirty(true)
      render(<Toolbar />)

      const newButton = screen.getByTitle('New File (Cmd+N)')
      fireEvent.click(newButton)

      expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?')
      expect(mockNewFile).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  describe('view mode switching', () => {
    it('should switch to split view mode', () => {
      render(<Toolbar />)

      const splitButton = screen.getByRole('button', { name: 'Split' })
      fireEvent.click(splitButton)

      expect(useEditorStore.getState().viewMode).toBe('split')
    })

    it('should switch to preview view mode', () => {
      render(<Toolbar />)

      const previewButton = screen.getByRole('button', { name: 'Preview' })
      fireEvent.click(previewButton)

      expect(useEditorStore.getState().viewMode).toBe('preview')
    })

    it('should switch back to edit view mode', () => {
      useEditorStore.getState().setViewMode('preview')
      render(<Toolbar />)

      const editButton = screen.getByRole('button', { name: 'Edit' })
      fireEvent.click(editButton)

      expect(useEditorStore.getState().viewMode).toBe('edit')
    })
  })

  describe('dark mode toggle', () => {
    it('should toggle dark mode', () => {
      render(<Toolbar />)

      const darkModeButton = screen.getByTitle('Toggle Dark Mode')
      fireEvent.click(darkModeButton)

      expect(useEditorStore.getState().isDarkMode).toBe(true)

      fireEvent.click(darkModeButton)

      expect(useEditorStore.getState().isDarkMode).toBe(false)
    })
  })

  describe('sidebar toggle', () => {
    it('should toggle sidebar visibility', () => {
      render(<Toolbar />)

      const sidebarButton = screen.getByTitle('Toggle Sidebar')
      fireEvent.click(sidebarButton)

      expect(useEditorStore.getState().showSidebar).toBe(false)

      fireEvent.click(sidebarButton)

      expect(useEditorStore.getState().showSidebar).toBe(true)
    })
  })

  describe('format buttons', () => {
    it('should dispatch editor-format event when format button is clicked', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      const boldButton = screen.getByTitle('Bold (Cmd+B)')
      fireEvent.click(boldButton)

      expect(dispatchEventSpy).toHaveBeenCalled()
      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-format' && event.detail?.format === 'bold'
      })
      expect(call).toBeTruthy()

      dispatchEventSpy.mockRestore()
    })
  })
})
