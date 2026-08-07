import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { Toolbar } from '../Toolbar'
import { useEditorStore } from '../../../stores/editorStore'

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
      canUndo: false,
      canRedo: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    // 精简后的工具栏：只保留高频操作，文件/格式化入口在原生菜单与右键菜单
    it('should render high-frequency controls only', () => {
      render(<Toolbar />)
      expect(screen.getByTitle('Toggle Sidebar')).toBeInTheDocument()
      expect(screen.getByTitle('Undo (Cmd+Z)')).toBeInTheDocument()
      expect(screen.getByTitle('Redo (Cmd+Shift+Z)')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'WYSIWYG' })).toBeInTheDocument()
      expect(screen.getByTitle('Toggle Dark Mode')).toBeInTheDocument()
      expect(screen.getByTitle('More')).toBeInTheDocument()

      // 已移除的入口
      expect(screen.queryByTitle('Open File (Cmd+O)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Save (Cmd+S)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('New File (Cmd+N)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Bold (Cmd+B)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Insert')).not.toBeInTheDocument()
      expect(screen.queryByTitle('More Formatting')).not.toBeInTheDocument()
    })
  })

  describe('undo / redo', () => {
    it('should dispatch editor-undo / editor-redo events', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')
      useEditorStore.setState({ canUndo: true, canRedo: true })
      render(<Toolbar />)

      fireEvent.click(screen.getByTitle('Undo (Cmd+Z)'))
      fireEvent.click(screen.getByTitle('Redo (Cmd+Shift+Z)'))

      const types = dispatchEventSpy.mock.calls.map((call) => (call[0] as CustomEvent).type)
      expect(types).toContain('editor-undo')
      expect(types).toContain('editor-redo')

      dispatchEventSpy.mockRestore()
    })

    it('should disable undo/redo buttons per store state', () => {
      render(<Toolbar />)
      expect(screen.getByTitle('Undo (Cmd+Z)')).toBeDisabled()
      expect(screen.getByTitle('Redo (Cmd+Shift+Z)')).toBeDisabled()
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
      fireEvent.click(screen.getByText('Reset Zoom (Cmd+Shift+0)'))
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

  describe('insert dialogs (app-open-dialog 事件驱动)', () => {
    function openDialog(dialog: 'table' | 'admonition') {
      act(() => {
        window.dispatchEvent(new CustomEvent('app-open-dialog', { detail: { dialog } }))
      })
    }

    it('should open table dialog via app-open-dialog event', () => {
      render(<Toolbar />)

      // Initially, dialog should not be visible
      expect(screen.queryByText('Insert Table')).not.toBeInTheDocument()

      openDialog('table')

      // Dialog should now be visible
      expect(screen.getByText('Insert Table')).toBeInTheDocument()
    })

    it('should close table dialog when Cancel is clicked', () => {
      render(<Toolbar />)

      openDialog('table')
      expect(screen.getByText('Insert Table')).toBeInTheDocument()

      // Click cancel
      fireEvent.click(screen.getByText('Cancel'))

      // Dialog should be closed
      expect(screen.queryByText('Insert Table')).not.toBeInTheDocument()
    })

    it('should dispatch editor-insert event when table is inserted', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)
      openDialog('table')

      // Insert table
      fireEvent.click(screen.getByText('Insert'))

      // Should dispatch insert event with table markdown
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
      openDialog('table')

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
      openDialog('admonition')

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
      openDialog('admonition')
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
