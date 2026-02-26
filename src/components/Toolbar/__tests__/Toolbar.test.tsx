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
      viewMode: 'source',
      activeBlockId: null,
      language: 'en',
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

    it('should switch back to source view mode', () => {
      useEditorStore.getState().setViewMode('preview')
      render(<Toolbar />)

      const sourceButton = screen.getByRole('button', { name: 'Source' })
      fireEvent.click(sourceButton)

      expect(useEditorStore.getState().viewMode).toBe('source')
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

  describe('language switcher', () => {
    it('should render language selector', () => {
      render(<Toolbar />)

      const languageSelect = screen.getByTitle('Toggle Dark Mode').previousElementSibling
      expect(languageSelect).toBeInTheDocument()
    })

    it('should change language when selecting different option', () => {
      const changeLanguageSpy = vi.fn()
      vi.doMock('react-i18next', () => ({
        useTranslation: () => ({
          t: (key: string) => key,
          i18n: {
            changeLanguage: changeLanguageSpy,
            language: 'en',
          },
        }),
      }))

      render(<Toolbar />)

      // Get language select element
      const languageSelect = screen.getByDisplayValue('🇺🇸 English') as HTMLSelectElement
      expect(languageSelect).toBeInTheDocument()

      // Change language to Chinese
      fireEvent.change(languageSelect, { target: { value: 'zh-CN' } })

      // Verify store was updated
      expect(useEditorStore.getState().language).toBe('zh-CN')
    })
  })

  describe('table button', () => {
    it('should open table dialog when table button is clicked', () => {
      render(<Toolbar />)

      // Initially, dialog should not be visible
      expect(screen.queryByText('Insert Table')).not.toBeInTheDocument()

      // Click table button
      const tableButton = screen.getByTitle('Insert Table')
      fireEvent.click(tableButton)

      // Dialog should now be visible
      expect(screen.getByText('Insert Table')).toBeInTheDocument()
    })

    it('should close table dialog when Cancel is clicked', () => {
      render(<Toolbar />)

      // Open dialog
      const tableButton = screen.getByTitle('Insert Table')
      fireEvent.click(tableButton)

      // Dialog should be visible
      expect(screen.getByText('Insert Table')).toBeInTheDocument()

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'))

      // Dialog should be closed
      expect(screen.queryByText('Insert Table')).not.toBeInTheDocument()
    })

    it('should dispatch editor-insert event when table is inserted', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      // Open dialog
      const tableButton = screen.getByTitle('Insert Table')
      fireEvent.click(tableButton)

      // Insert table
      fireEvent.click(screen.getByText('Insert'))

      // Should dispatch insert event with table markdown
      expect(dispatchEventSpy).toHaveBeenCalled()
      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-insert' && event.detail?.text?.includes('Column 1')
      })
      expect(call).toBeTruthy()

      dispatchEventSpy.mockRestore()
    })

    it('should insert table with custom dimensions', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      // Open dialog
      fireEvent.click(screen.getByTitle('Insert Table'))

      // Change dimensions
      const rowInput = screen.getAllByRole('spinbutton')[0]
      const colInput = screen.getAllByRole('spinbutton')[1]

      fireEvent.change(rowInput, { target: { value: '5' } })
      fireEvent.change(colInput, { target: { value: '4' } })

      // Insert table
      fireEvent.click(screen.getByText('Insert'))

      // Should dispatch insert event
      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-insert'
      })

      expect(call).toBeTruthy()
      const tableMarkdown = (call![0] as CustomEvent).detail.text as string

      // Check table has 5 rows (excluding header)
      const lines = tableMarkdown.split('\n')
      expect(lines).toHaveLength(7) // header + separator + 5 data rows

      dispatchEventSpy.mockRestore()
    })
  })
})
