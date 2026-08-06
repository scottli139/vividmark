import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Toolbar } from '../Toolbar'
import { useEditorStore } from '../../../stores/editorStore'
import { useDialogStore } from '../../../stores/dialogStore'

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
      viewMode: 'wysiwyg',
      activeBlockId: null,
      language: 'en',
      zoomLevel: 100,
      isSettingsOpen: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    // 文件名现在显示在窗口标题栏，不再在工具栏中
    it('should render toolbar', () => {
      render(<Toolbar />)
      // 检查关键元素存在
      expect(screen.getByTitle('Open File (Cmd+O)')).toBeInTheDocument()
      expect(screen.getByTitle('Save (Cmd+S)')).toBeInTheDocument()
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

    it('should confirm before creating new file when document is dirty', async () => {
      useEditorStore.getState().setDirty(true)
      render(<Toolbar />)

      const newButton = screen.getByTitle('New File (Cmd+N)')
      fireEvent.click(newButton)

      // 自绘弹窗出现（替代原生 confirm）
      expect(useDialogStore.getState().current?.message).toBe('Discard unsaved changes?')
      expect(useDialogStore.getState().current?.kind).toBe('confirm')

      act(() => {
        useDialogStore.getState().answer(true)
      })

      await waitFor(() => {
        expect(mockNewFile).toHaveBeenCalledTimes(1)
      })
    })

    it('should not create new file if user cancels confirmation', async () => {
      useEditorStore.getState().setDirty(true)
      render(<Toolbar />)

      const newButton = screen.getByTitle('New File (Cmd+N)')
      fireEvent.click(newButton)

      expect(useDialogStore.getState().current?.message).toBe('Discard unsaved changes?')

      act(() => {
        useDialogStore.getState().answer(false)
      })

      await waitFor(() => {
        expect(useDialogStore.getState().current).toBeNull()
      })
      expect(mockNewFile).not.toHaveBeenCalled()
    })
  })

  describe('view mode switching', () => {
    it('should default to wysiwyg view mode', () => {
      render(<Toolbar />)

      // WYSIWYG button should be active by default (has active background class)
      const wysiwygButton = screen.getByRole('button', { name: 'WYSIWYG' })
      expect(wysiwygButton).toBeInTheDocument()
      expect(useEditorStore.getState().viewMode).toBe('wysiwyg')
    })

    it('should switch to source view mode', () => {
      render(<Toolbar />)

      const sourceButton = screen.getByRole('button', { name: 'Source' })
      fireEvent.click(sourceButton)

      expect(useEditorStore.getState().viewMode).toBe('source')
    })

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

    it('should switch back to wysiwyg view mode', () => {
      useEditorStore.getState().setViewMode('source')
      render(<Toolbar />)

      const wysiwygButton = screen.getByRole('button', { name: 'WYSIWYG' })
      fireEvent.click(wysiwygButton)

      expect(useEditorStore.getState().viewMode).toBe('wysiwyg')
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

    it('should dispatch editor-format event from format menu', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      // 打开更多格式化菜单
      const moreButton = screen.getByTitle('More Formatting')
      fireEvent.click(moreButton)

      // 点击任务列表选项（现在在下拉菜单中）
      const tasklistOption = screen.getByText('Task List')
      fireEvent.click(tasklistOption)

      expect(dispatchEventSpy).toHaveBeenCalled()
      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-format' && event.detail?.format === 'tasklist'
      })
      expect(call).toBeTruthy()

      dispatchEventSpy.mockRestore()
    })
  })

  describe('language switcher', () => {
    it('should render language options in more menu with current language checked', () => {
      render(<Toolbar />)

      // 打开更多菜单
      fireEvent.click(screen.getByTitle('More'))

      // 当前语言（en）项应勾选，另一项不勾选
      const enItem = screen.getByText('EN').closest('button')
      const zhItem = screen.getByText('中').closest('button')
      expect(enItem).toHaveAttribute('aria-checked', 'true')
      expect(zhItem).toHaveAttribute('aria-checked', 'false')
    })

    it('should change language when selecting menu item', () => {
      render(<Toolbar />)

      // 打开更多菜单并选择中文
      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('中'))

      // Verify store was updated
      expect(useEditorStore.getState().language).toBe('zh-CN')
    })
  })

  describe('export pdf', () => {
    it('should dispatch editor-request-html event when export pdf menu item is clicked', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      // 打开更多菜单并点击导出 PDF
      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('Export PDF (Cmd+P)'))

      expect(dispatchEventSpy).toHaveBeenCalled()
      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-request-html'
      })
      expect(call).toBeTruthy()

      dispatchEventSpy.mockRestore()
    })

    it('should render export pdf item in more menu', () => {
      render(<Toolbar />)

      fireEvent.click(screen.getByTitle('More'))

      expect(screen.getByText('Export PDF (Cmd+P)')).toBeInTheDocument()
    })
  })

  describe('more menu', () => {
    it('should open more menu when trigger is clicked', () => {
      render(<Toolbar />)

      // 菜单初始不可见
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()

      fireEvent.click(screen.getByTitle('More'))

      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('should call zoomIn / zoomOut / zoomReset from menu items', () => {
      render(<Toolbar />)

      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('Zoom In (Cmd+=)'))
      expect(useEditorStore.getState().zoomLevel).toBe(110)

      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('Zoom Out (Cmd+-)'))
      expect(useEditorStore.getState().zoomLevel).toBe(100)

      act(() => {
        useEditorStore.getState().setZoomLevel(150)
      })
      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('Reset Zoom (Cmd+0)'))
      expect(useEditorStore.getState().zoomLevel).toBe(100)
    })

    it('should open settings dialog when settings item is clicked', () => {
      render(<Toolbar />)

      expect(useEditorStore.getState().isSettingsOpen).toBe(false)

      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('Settings'))

      expect(useEditorStore.getState().isSettingsOpen).toBe(true)
    })
  })

  describe('insert menu', () => {
    it('should open table dialog from insert menu', () => {
      render(<Toolbar />)

      // Initially, dialog should not be visible
      expect(screen.queryByText('Insert Table')).not.toBeInTheDocument()

      // 打开插入菜单
      const insertButton = screen.getByTitle('Insert')
      fireEvent.click(insertButton)

      // 点击表格选项
      const tableOption = screen.getByText('Insert Table')
      fireEvent.click(tableOption)

      // Dialog should now be visible
      expect(screen.getByText('Insert Table')).toBeInTheDocument()
    })

    it('should close table dialog when Cancel is clicked', () => {
      render(<Toolbar />)

      // Open dialog
      fireEvent.click(screen.getByTitle('Insert'))
      fireEvent.click(screen.getByText('Insert Table'))

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
      fireEvent.click(screen.getByTitle('Insert'))
      fireEvent.click(screen.getByText('Insert Table'))

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
      fireEvent.click(screen.getByTitle('Insert'))
      fireEvent.click(screen.getByText('Insert Table'))

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

    it('should insert admonition with selected type and custom title', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      // 打开插入菜单 → 点击提示框选项
      fireEvent.click(screen.getByTitle('Insert'))
      fireEvent.click(screen.getByText('Admonition'))

      // 对话框可见，默认选中 Note
      expect(screen.getByText('Insert Admonition')).toBeInTheDocument()

      // 选 warning 类型 + 填自定义标题
      fireEvent.click(screen.getByText('Warning'))
      // 选中态：accent outline（不能用 ring/box-shadow——会被 .admonition 的 box-shadow 覆盖）
      expect(screen.getByText('Warning').closest('button')?.className).toContain('outline-2')
      expect(screen.getByText('Note').closest('button')?.className).not.toContain('outline-2')
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '注意' } })
      fireEvent.click(screen.getByText('Insert'))

      // 应派发 editor-insert，片段为 ::: warning 注意 围栏
      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-insert' && event.detail?.text?.includes('::: warning 注意')
      })
      expect(call).toBeTruthy()

      // 对话框已关闭
      expect(screen.queryByText('Insert Admonition')).not.toBeInTheDocument()

      dispatchEventSpy.mockRestore()
    })

    it('should insert admonition with default type and no title', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      fireEvent.click(screen.getByTitle('Insert'))
      fireEvent.click(screen.getByText('Admonition'))
      fireEvent.click(screen.getByText('Insert'))

      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-insert'
      })
      expect(call).toBeTruthy()
      expect((call![0] as CustomEvent).detail.text).toBe('::: note\n\n:::\n')

      dispatchEventSpy.mockRestore()
    })
  })
})
