import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Sidebar } from '../Sidebar'
import { useEditorStore } from '../../../stores/editorStore'
import { useDialogStore } from '../../../stores/dialogStore'

// Mock fileOps module
vi.mock('../../../lib/fileOps', () => ({
  openFileByPath: vi.fn(),
}))

// Mock Tauri dialog plugin（「打开文件夹」按钮）
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

// Mock FileTree component
vi.mock('../../FileTree', () => ({
  FileTree: () => <div data-testid="file-tree">FileTree Component</div>,
}))

// Mock outlineUtils module（extractOutline 用简化实现；树构建/高亮匹配用真实纯函数）
vi.mock('../../../lib/outlineUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/outlineUtils')>()
  return {
    ...actual,
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
    scrollPreviewToHeading: vi.fn(),
  }
})

// Import mocked function
import { openFileByPath } from '../../../lib/fileOps'
import { open } from '@tauri-apps/plugin-dialog'
const mockOpenFileByPath = vi.mocked(openFileByPath)
const mockOpenDialog = vi.mocked(open)

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
      sidebarTab: 'outline',
      sidebarWidth: 224,
      openedFolder: null,
      viewMode: 'source',
      activeBlockId: null,
      cursorLine: 1,
      cursorCol: 1,
      activeHeadingIndex: null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('visibility', () => {
    it('should render when sidebar is visible', () => {
      render(<Sidebar />)
      expect(screen.getByText('Files')).toBeInTheDocument()
      expect(screen.getByText('Outline')).toBeInTheDocument()
    })

    it('should not render when sidebar is hidden', () => {
      useEditorStore.getState().toggleSidebar()

      const { container } = render(<Sidebar />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('sidebar width', () => {
    it('should render with width from store', () => {
      useEditorStore.setState({ sidebarWidth: 300 })

      const { container } = render(<Sidebar />)
      expect(container.firstChild).toHaveStyle({ width: '300px' })
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

  describe('outline debounce', () => {
    it('should update outline after debounce when content changes', async () => {
      render(<Sidebar />)

      expect(screen.getByText('Heading 1')).toBeInTheDocument()

      act(() => {
        useEditorStore.getState().setContent('# New Heading\n\nSome text')
      })

      // 大纲使用 200ms 防抖的内容，等待更新
      await waitFor(() => {
        expect(screen.getByText('New Heading')).toBeInTheDocument()
      })
      expect(screen.queryByText('Heading 1')).not.toBeInTheDocument()
    })
  })

  describe('recent files', () => {
    beforeEach(() => {
      // 最近文件位于「文件」tab（未打开文件夹时）
      useEditorStore.getState().setSidebarTab('files')
    })

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

    it('should confirm before opening recent file when document is dirty', async () => {
      mockOpenFileByPath.mockResolvedValue(true)

      useEditorStore.getState().setDirty(true)
      useEditorStore.getState().addRecentFile('/path/to/file.md', 'file.md')

      render(<Sidebar />)

      const fileItem = screen.getByText('file.md')
      fireEvent.click(fileItem)

      // 自绘弹窗出现（替代原生 confirm）
      expect(useDialogStore.getState().current?.message).toBe('Discard unsaved changes?')

      act(() => {
        useDialogStore.getState().answer(true)
      })

      await waitFor(() => {
        expect(mockOpenFileByPath).toHaveBeenCalledWith('/path/to/file.md')
      })
    })

    it('should not open recent file if user cancels confirmation', async () => {
      useEditorStore.getState().setDirty(true)
      useEditorStore.getState().addRecentFile('/path/to/file.md', 'file.md')

      render(<Sidebar />)

      const fileItem = screen.getByText('file.md')
      fireEvent.click(fileItem)

      expect(useDialogStore.getState().current).not.toBeNull()

      act(() => {
        useDialogStore.getState().answer(false)
      })

      await waitFor(() => {
        expect(useDialogStore.getState().current).toBeNull()
      })
      expect(mockOpenFileByPath).not.toHaveBeenCalled()
    })

    it('should show open folder button', () => {
      render(<Sidebar />)
      expect(screen.getByText('Open Folder')).toBeInTheDocument()
    })

    it('should open folder dialog when open folder button is clicked', async () => {
      mockOpenDialog.mockResolvedValue('/test/folder')

      render(<Sidebar />)

      fireEvent.click(screen.getByText('Open Folder'))

      await waitFor(() => {
        expect(useEditorStore.getState().openedFolder).toBe('/test/folder')
      })
    })

    it('should not show filter input when no recent files', () => {
      render(<Sidebar />)
      expect(screen.queryByPlaceholderText('Filter recent files...')).not.toBeInTheDocument()
    })

    it('should filter recent files by name (case-insensitive)', () => {
      useEditorStore.getState().addRecentFile('/path/to/Notes.md', 'Notes.md')
      useEditorStore.getState().addRecentFile('/path/to/todo.md', 'todo.md')

      render(<Sidebar />)

      fireEvent.change(screen.getByPlaceholderText('Filter recent files...'), {
        target: { value: 'NOTES' },
      })

      expect(screen.getByText('Notes.md')).toBeInTheDocument()
      expect(screen.queryByText('todo.md')).not.toBeInTheDocument()
    })

    it('should filter recent files by path', () => {
      useEditorStore.getState().addRecentFile('/docs/guide.md', 'guide.md')
      useEditorStore.getState().addRecentFile('/src/readme.md', 'readme.md')

      render(<Sidebar />)

      fireEvent.change(screen.getByPlaceholderText('Filter recent files...'), {
        target: { value: '/src' },
      })

      expect(screen.getByText('readme.md')).toBeInTheDocument()
      expect(screen.queryByText('guide.md')).not.toBeInTheDocument()
    })

    it('should show empty state when filter matches nothing', () => {
      useEditorStore.getState().addRecentFile('/path/to/file.md', 'file.md')

      render(<Sidebar />)

      fireEvent.change(screen.getByPlaceholderText('Filter recent files...'), {
        target: { value: 'zzz' },
      })

      expect(screen.getByText('No recent files')).toBeInTheDocument()
      expect(screen.queryByText('file.md')).not.toBeInTheDocument()
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

  describe('tab switching', () => {
    it('should show outline tab by default', () => {
      render(<Sidebar />)

      // Outline tab should be active
      const outlineTab = screen.getByText('Outline')
      expect(outlineTab).toHaveClass('text-[var(--accent-color)]')

      // Outline content should be visible
      expect(screen.getByText('Heading 1')).toBeInTheDocument()
    })

    it('should switch to files tab when clicked', () => {
      render(<Sidebar />)

      const filesTab = screen.getByText('Files')
      fireEvent.click(filesTab)

      // Files tab should be active and persisted to store
      expect(useEditorStore.getState().sidebarTab).toBe('files')
      expect(filesTab).toHaveClass('text-[var(--accent-color)]')

      // 未打开文件夹时显示最近文件区块
      expect(screen.getByText('Recent Files')).toBeInTheDocument()
    })

    it('should show file tree in files tab when a folder is opened', () => {
      useEditorStore.setState({ sidebarTab: 'files', openedFolder: '/test/folder' })

      render(<Sidebar />)

      expect(screen.getByTestId('file-tree')).toBeInTheDocument()
    })

    it('should switch back to outline tab when clicked', () => {
      useEditorStore.getState().setSidebarTab('files')

      render(<Sidebar />)

      const outlineTab = screen.getByText('Outline')
      fireEvent.click(outlineTab)

      // Outline tab should be active and persisted to store
      expect(useEditorStore.getState().sidebarTab).toBe('outline')
      expect(outlineTab).toHaveClass('text-[var(--accent-color)]')

      // Outline content should be visible
      expect(screen.getByText('Heading 1')).toBeInTheDocument()
    })

    it('should render tab buttons with correct styling', () => {
      render(<Sidebar />)

      const outlineTab = screen.getByText('Outline')
      const filesTab = screen.getByText('Files')

      // Both tabs should have base styling
      expect(outlineTab).toHaveClass('flex-1', 'px-3', 'py-2', 'text-xs', 'font-medium')
      expect(filesTab).toHaveClass('flex-1', 'px-3', 'py-2', 'text-xs', 'font-medium')
    })
  })

  describe('outline collapse', () => {
    beforeEach(() => {
      // 层级：H1 > [H2 > [H3], H2b]，H4 为根级兄弟
      useEditorStore.setState({
        content: '# H1\n\n## H2\n\n### H3\n\n## H2b\n\n# H4',
      })
    })

    it('should render chevrons only for items with children', () => {
      render(<Sidebar />)

      // H1（含 H2/H2b）与 H2（含 H3）有 chevron；H3/H2b/H4 无子级
      expect(screen.getAllByRole('button', { name: 'Collapse' })).toHaveLength(2)
    })

    it('should collapse and expand children via chevron', () => {
      render(<Sidebar />)

      // 默认全展开
      for (const text of ['H1', 'H2', 'H3', 'H2b', 'H4']) {
        expect(screen.getByText(text)).toBeInTheDocument()
      }

      // 折叠 H1 → 整个子树隐藏，根级兄弟 H4 不受影响
      fireEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[0])
      expect(screen.getByText('H1')).toBeInTheDocument()
      expect(screen.queryByText('H2')).not.toBeInTheDocument()
      expect(screen.queryByText('H3')).not.toBeInTheDocument()
      expect(screen.queryByText('H2b')).not.toBeInTheDocument()
      expect(screen.getByText('H4')).toBeInTheDocument()

      // 再点展开（折叠后 aria-label 变为 Expand，且只剩 H1 一个 chevron）
      fireEvent.click(screen.getByRole('button', { name: 'Expand' }))
      expect(screen.getByText('H2')).toBeInTheDocument()
      expect(screen.getByText('H3')).toBeInTheDocument()
      expect(screen.getByText('H2b')).toBeInTheDocument()
    })

    it('should collapse a nested subtree independently', () => {
      render(<Sidebar />)

      // 折叠 H2 → 仅其子级 H3 隐藏，H2b 不受影响
      fireEvent.click(screen.getAllByRole('button', { name: 'Collapse' })[1])
      expect(screen.getByText('H2')).toBeInTheDocument()
      expect(screen.queryByText('H3')).not.toBeInTheDocument()
      expect(screen.getByText('H2b')).toBeInTheDocument()
    })

    it('should still dispatch jump event when clicking heading text', () => {
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

      render(<Sidebar />)

      fireEvent.click(screen.getByText('H3'))

      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent
      expect(event.type).toBe('editor-scroll-to-heading')
      expect(event.detail.index).toBe(2)

      dispatchEventSpy.mockRestore()
    })
  })

  describe('outline active highlight', () => {
    // content: '# Heading 1\n\nSome content\n\n## Heading 2'（外层 beforeEach）
    // lineIndex: Heading 1 = 0，Heading 2 = 4
    const rowOf = (text: string) => screen.getByText(text).parentElement

    it('should highlight the current heading by cursorLine in source mode', () => {
      render(<Sidebar />)

      // cursorLine=1 → Heading 1 高亮
      expect(rowOf('Heading 1')).toHaveClass('bg-[var(--active-bg)]')
      expect(rowOf('Heading 2')).not.toHaveClass('bg-[var(--active-bg)]')

      act(() => {
        useEditorStore.getState().setCursorPosition(5, 1)
      })

      expect(rowOf('Heading 1')).not.toHaveClass('bg-[var(--active-bg)]')
      expect(rowOf('Heading 2')).toHaveClass('bg-[var(--active-bg)]')
      expect(rowOf('Heading 2')).toHaveClass('border-[var(--accent-color)]')
    })

    it('should not highlight when cursor is before the first heading', () => {
      useEditorStore.setState({ content: 'intro\n\n# H1' })
      render(<Sidebar />)

      act(() => {
        useEditorStore.getState().setCursorPosition(1, 1)
      })

      expect(rowOf('H1')).not.toHaveClass('bg-[var(--active-bg)]')
    })

    it('should follow activeHeadingIndex in wysiwyg mode', () => {
      useEditorStore.setState({ viewMode: 'wysiwyg' })
      render(<Sidebar />)

      expect(rowOf('Heading 1')).not.toHaveClass('bg-[var(--active-bg)]')

      act(() => {
        useEditorStore.getState().setActiveHeadingIndex(1)
      })
      expect(rowOf('Heading 2')).toHaveClass('bg-[var(--active-bg)]')

      act(() => {
        useEditorStore.getState().setActiveHeadingIndex(null)
      })
      expect(rowOf('Heading 2')).not.toHaveClass('bg-[var(--active-bg)]')
    })

    it('should not highlight in preview mode', () => {
      useEditorStore.setState({ viewMode: 'preview' })
      render(<Sidebar />)

      act(() => {
        useEditorStore.getState().setCursorPosition(5, 1)
      })

      expect(rowOf('Heading 1')).not.toHaveClass('bg-[var(--active-bg)]')
      expect(rowOf('Heading 2')).not.toHaveClass('bg-[var(--active-bg)]')
    })

    it('should scroll the active item into view when the highlight changes', () => {
      const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView')
      render(<Sidebar />)

      act(() => {
        useEditorStore.getState().setCursorPosition(5, 1)
      })

      expect(scrollSpy).toHaveBeenCalledWith({ block: 'nearest' })

      scrollSpy.mockRestore()
    })
  })
})
