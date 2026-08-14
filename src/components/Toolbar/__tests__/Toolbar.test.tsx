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
      themeMode: 'light',
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
    // 极简工具栏：只剩更多菜单；侧栏开关移状态栏左侧，撤销/重做到编辑菜单，视图模式到状态栏，暗色到更多菜单
    it('should render minimal controls only', () => {
      render(<Toolbar />)
      expect(screen.getByTitle('More')).toBeInTheDocument()

      // 已移除的入口
      expect(screen.queryByTitle('Toggle Sidebar')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Undo (Cmd+Z)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Redo (Cmd+Shift+Z)')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'WYSIWYG' })).not.toBeInTheDocument()
      expect(screen.queryByTitle('Toggle Dark Mode')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Open File (Cmd+O)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Save (Cmd+S)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('New File (Cmd+N)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Bold (Cmd+B)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Insert')).not.toBeInTheDocument()
      expect(screen.queryByTitle('More Formatting')).not.toBeInTheDocument()
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

  describe('theme switcher', () => {
    it('should render theme options in more menu with current theme checked', () => {
      render(<Toolbar />)

      fireEvent.click(screen.getByTitle('More'))

      expect(screen.getByText('Light').closest('button')).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByText('Dark').closest('button')).toHaveAttribute('aria-checked', 'false')
      expect(screen.getByText('System').closest('button')).toHaveAttribute('aria-checked', 'false')
    })

    it('should change theme when selecting menu item', () => {
      render(<Toolbar />)

      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('Dark'))

      expect(useEditorStore.getState().themeMode).toBe('dark')
      expect(useEditorStore.getState().isDarkMode).toBe(true)
    })
  })

  describe('export pdf', () => {
    it('should dispatch editor-export-pdf event when export pdf menu item is clicked', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Toolbar />)

      // 打开更多菜单并点击导出 PDF
      fireEvent.click(screen.getByTitle('More'))
      fireEvent.click(screen.getByText('Export PDF (Cmd+P)'))

      expect(dispatchEventSpy).toHaveBeenCalled()
      const call = dispatchEventSpy.mock.calls.find((call) => {
        const event = call[0] as CustomEvent
        return event.type === 'editor-export-pdf'
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
