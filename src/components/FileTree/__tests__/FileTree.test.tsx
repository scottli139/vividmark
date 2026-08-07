import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FileTree } from '../FileTree'
import { useEditorStore } from '../../../stores/editorStore'
import { useDialogStore } from '../../../stores/dialogStore'

// Mock Tauri APIs - must be self-contained factory
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

// Mock fileOps
vi.mock('../../../lib/fileOps', () => ({
  openFileByPath: vi.fn().mockResolvedValue(true),
}))

const mockTree = [
  {
    name: 'docs',
    path: '/root/docs',
    isDirectory: true,
    children: [
      { name: 'guide.md', path: '/root/docs/guide.md', isDirectory: false },
      {
        name: 'nested',
        path: '/root/docs/nested',
        isDirectory: true,
        children: [{ name: 'deep.md', path: '/root/docs/nested/deep.md', isDirectory: false }],
      },
    ],
  },
  { name: 'README.md', path: '/root/README.md', isDirectory: false },
]

function mockReadDirectory(items: unknown = mockTree) {
  vi.mocked(invoke).mockImplementation(async (cmd: string) => {
    if (cmd === 'read_directory') return items
    return null
  })
}

/** read_directory 调用次数 */
function readDirectoryCalls() {
  return vi.mocked(invoke).mock.calls.filter((call) => call[0] === 'read_directory').length
}

describe('FileTree', () => {
  beforeEach(() => {
    // Reset stores
    useEditorStore.setState({
      openedFolder: null,
      filePath: null,
      fileName: 'Untitled.md',
      isDirty: false,
      recentFiles: [],
    })
    useDialogStore.setState({ current: null })
    mockReadDirectory()
  })

  describe('when no folder is opened', () => {
    it('should show open folder button', () => {
      render(<FileTree />)
      expect(screen.getByText('Open Folder')).toBeInTheDocument()
    })
  })

  describe('tree rendering and collapse strategy', () => {
    beforeEach(() => {
      useEditorStore.setState({ openedFolder: '/root' })
    })

    it('should render tree and expand only first-level directories by default', async () => {
      render(<FileTree />)

      // 第一层目录 docs 展开，其直接子项可见
      expect(await screen.findByText('docs')).toBeInTheDocument()
      expect(screen.getByText('guide.md')).toBeInTheDocument()
      expect(screen.getByText('nested')).toBeInTheDocument()
      expect(screen.getByText('README.md')).toBeInTheDocument()
      // 第二层目录 nested 折叠，deep.md 不可见
      expect(screen.queryByText('deep.md')).not.toBeInTheDocument()
    })

    it('should toggle folder expansion on click', async () => {
      render(<FileTree />)
      await screen.findByText('docs')

      // 展开 nested
      fireEvent.click(screen.getByText('nested'))
      expect(await screen.findByText('deep.md')).toBeInTheDocument()

      // 再点击折叠
      fireEvent.click(screen.getByText('nested'))
      expect(screen.queryByText('deep.md')).not.toBeInTheDocument()
    })

    it('should expand parent chain when current file is inside the tree', async () => {
      useEditorStore.setState({ filePath: '/root/docs/nested/deep.md', fileName: 'deep.md' })
      render(<FileTree />)

      expect(await screen.findByText('deep.md')).toBeInTheDocument()
    })
  })

  describe('filter', () => {
    beforeEach(() => {
      useEditorStore.setState({ openedFolder: '/root' })
    })

    it('should filter by name and temporarily expand all matches', async () => {
      render(<FileTree />)
      await screen.findByText('docs')

      fireEvent.change(screen.getByPlaceholderText('Filter files...'), {
        target: { value: 'deep' },
      })

      // 命中项及其祖先链可见（临时全展开），未命中项隐藏
      expect(await screen.findByText('deep.md')).toBeInTheDocument()
      expect(screen.getByText('docs')).toBeInTheDocument()
      expect(screen.getByText('nested')).toBeInTheDocument()
      expect(screen.queryByText('README.md')).not.toBeInTheDocument()
      expect(screen.queryByText('guide.md')).not.toBeInTheDocument()
    })

    it('should restore original expansion when query is cleared', async () => {
      render(<FileTree />)
      await screen.findByText('docs')

      const input = screen.getByPlaceholderText('Filter files...')
      fireEvent.change(input, { target: { value: 'deep' } })
      await screen.findByText('deep.md')

      fireEvent.change(input, { target: { value: '' } })

      expect(await screen.findByText('README.md')).toBeInTheDocument()
      // 恢复默认折叠策略：deep.md 再次隐藏
      expect(screen.queryByText('deep.md')).not.toBeInTheDocument()
    })

    it('should show no-matches hint when filter has no result', async () => {
      render(<FileTree />)
      await screen.findByText('docs')

      fireEvent.change(screen.getByPlaceholderText('Filter files...'), {
        target: { value: 'zzz-no-match' },
      })

      expect(await screen.findByText('No matching files')).toBeInTheDocument()
    })
  })

  describe('context menu', () => {
    beforeEach(() => {
      useEditorStore.setState({ openedFolder: '/root' })
    })

    it('should show item menu on node context menu', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))

      expect(await screen.findByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('New File')).toBeInTheDocument()
      expect(screen.getByText('New Folder')).toBeInTheDocument()
      expect(screen.getByText('Rename')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('should show blank-area menu on container context menu', async () => {
      mockReadDirectory([])
      render(<FileTree />)
      await screen.findByText('Empty folder')

      fireEvent.contextMenu(screen.getByText('Empty folder'))

      expect(await screen.findByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('New File')).toBeInTheDocument()
      expect(screen.getByText('New Folder')).toBeInTheDocument()
      expect(screen.getByText('Open Folder')).toBeInTheDocument()
      expect(screen.queryByText('Rename')).not.toBeInTheDocument()
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('item menu shows Typora-style extras (open/duplicate/copy path/reveal)', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))

      expect(await screen.findByRole('menu')).toBeInTheDocument()
      expect(screen.getByText('Open')).toBeInTheDocument()
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
      expect(screen.getByText('Copy File Path')).toBeInTheDocument()
      // 测试环境 navigator.platform = MacIntel → Finder 文案
      expect(screen.getByText('Reveal in Finder')).toBeInTheDocument()
    })

    it('folder item menu has no Open entry', async () => {
      render(<FileTree />)
      await screen.findByText('docs')

      fireEvent.contextMenu(screen.getByText('docs'))

      expect(await screen.findByRole('menu')).toBeInTheDocument()
      expect(screen.queryByText('Open')).not.toBeInTheDocument()
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
    })

    it('duplicate copies file with " copy" suffix next to the target', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'read_directory') return mockTree
        if (cmd === 'file_exists') return false
        if (cmd === 'copy_path') return null
        return null
      })
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Duplicate'))

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('copy_path', {
          oldPath: '/root/README.md',
          newPath: '/root/README copy.md',
        })
      })
    })

    it('duplicate bumps suffix when the first candidate exists', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string, args?: unknown) => {
        if (cmd === 'read_directory') return mockTree
        if (cmd === 'file_exists') {
          const path = (args as { path: string }).path
          return path === '/root/README copy.md' // 第一个候选被占用
        }
        if (cmd === 'copy_path') return null
        return null
      })
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Duplicate'))

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('copy_path', {
          oldPath: '/root/README.md',
          newPath: '/root/README copy 2.md',
        })
      })
    })

    it('copy path writes the absolute path to clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      })
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Copy File Path'))

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('/root/README.md')
      })
    })

    it('reveal invokes backend with the target path', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Reveal in Finder'))

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('reveal_in_folder', { path: '/root/README.md' })
      })
    })

    it('blank-area reveal acts on the opened folder', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      const scrollArea = document.querySelector('.overflow-y-auto')!
      fireEvent.contextMenu(scrollArea)
      fireEvent.click(await screen.findByText('Reveal in Finder'))

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('reveal_in_folder', { path: '/root' })
      })
    })

    it('should open folder from blank-area menu', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      const scrollArea = document.querySelector('.overflow-y-auto')!
      fireEvent.contextMenu(scrollArea)
      vi.mocked(open).mockResolvedValue('/new/root')

      fireEvent.click(await screen.findByText('Open Folder'))

      await waitFor(() => {
        expect(useEditorStore.getState().openedFolder).toBe('/new/root')
      })
    })
  })

  describe('create operations', () => {
    beforeEach(() => {
      useEditorStore.setState({ openedFolder: '/root' })
    })

    it('should create file at root from blank-area menu', async () => {
      mockReadDirectory([])
      render(<FileTree />)
      await screen.findByText('Empty folder')

      fireEvent.contextMenu(screen.getByText('Empty folder'))
      fireEvent.click(await screen.findByText('New File'))

      const input = await screen.findByPlaceholderText('New File')
      fireEvent.change(input, { target: { value: 'new.md' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('create_file', { path: '/root/new.md' })
      })
      // 操作成功后刷新
      expect(readDirectoryCalls()).toBeGreaterThanOrEqual(2)
    })

    it('should create folder inside target folder and keep it expanded after refresh', async () => {
      render(<FileTree />)
      await screen.findByText('docs')

      fireEvent.contextMenu(screen.getByText('docs'))
      fireEvent.click(await screen.findByText('New Folder'))

      // 目标文件夹内追加临时输入行
      const input = await screen.findByPlaceholderText('New Folder')
      fireEvent.change(input, { target: { value: 'sub' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('create_folder', { path: '/root/docs/sub' })
      })
      // 刷新后 docs 仍处于展开状态
      await waitFor(() => {
        expect(readDirectoryCalls()).toBeGreaterThanOrEqual(2)
      })
      expect(screen.getByText('guide.md')).toBeInTheDocument()
    })

    it('should create file as sibling when target is a file', async () => {
      render(<FileTree />)
      await screen.findByText('guide.md')

      fireEvent.contextMenu(screen.getByText('guide.md'))
      fireEvent.click(await screen.findByText('New File'))

      const input = await screen.findByPlaceholderText('New File')
      fireEvent.change(input, { target: { value: 'sibling.md' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('create_file', { path: '/root/docs/sibling.md' })
      })
    })

    it('should cancel creation on Escape', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('New File'))

      const input = await screen.findByPlaceholderText('New File')
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.queryByPlaceholderText('New File')).not.toBeInTheDocument()
      expect(invoke).not.toHaveBeenCalledWith('create_file', expect.anything())
    })

    it('should show alert dialog when creation fails', async () => {
      vi.mocked(invoke).mockImplementation(async (cmd: string) => {
        if (cmd === 'read_directory') return mockTree
        if (cmd === 'create_file') throw 'File already exists: /root/README.md'
        return null
      })
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('New File'))

      const input = await screen.findByPlaceholderText('New File')
      fireEvent.change(input, { target: { value: 'README.md' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(useDialogStore.getState().current?.kind).toBe('alert')
      })
      expect(useDialogStore.getState().current?.message).toBe(
        'File already exists: /root/README.md'
      )
      act(() => {
        useDialogStore.getState().answer(true)
      })
    })
  })

  describe('rename operations', () => {
    beforeEach(() => {
      useEditorStore.setState({ openedFolder: '/root' })
    })

    it('should rename file via inline input', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Rename'))

      const input = await screen.findByDisplayValue('README.md')
      fireEvent.change(input, { target: { value: 'NEW.md' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('rename_path', {
          oldPath: '/root/README.md',
          newPath: '/root/NEW.md',
        })
      })
      expect(readDirectoryCalls()).toBeGreaterThanOrEqual(2)
    })

    it('should cancel rename on Escape', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Rename'))

      const input = await screen.findByDisplayValue('README.md')
      fireEvent.keyDown(input, { key: 'Escape' })

      expect(screen.queryByDisplayValue('README.md')).not.toBeInTheDocument()
      expect(invoke).not.toHaveBeenCalledWith('rename_path', expect.anything())
    })

    it('should not invoke rename when name is unchanged', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Rename'))

      const input = await screen.findByDisplayValue('README.md')
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.queryByDisplayValue('README.md')).not.toBeInTheDocument()
      })
      expect(invoke).not.toHaveBeenCalledWith('rename_path', expect.anything())
    })

    it('should sync store when renaming the currently opened file', async () => {
      useEditorStore.setState({
        filePath: '/root/README.md',
        fileName: 'README.md',
        recentFiles: [{ path: '/root/README.md', name: 'README.md', lastOpened: 1 }],
      })
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Rename'))

      const input = await screen.findByDisplayValue('README.md')
      fireEvent.change(input, { target: { value: 'NEW.md' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(useEditorStore.getState().filePath).toBe('/root/NEW.md')
      })
      expect(useEditorStore.getState().fileName).toBe('NEW.md')
      expect(useEditorStore.getState().recentFiles[0].path).toBe('/root/NEW.md')
      expect(useEditorStore.getState().recentFiles[0].name).toBe('NEW.md')
    })
  })

  describe('delete operations', () => {
    beforeEach(() => {
      useEditorStore.setState({ openedFolder: '/root' })
    })

    it('should delete file after confirmation', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Delete'))

      // 确认弹窗出现
      expect(useDialogStore.getState().current?.kind).toBe('confirm')
      expect(useDialogStore.getState().current?.message).toBe('Delete "README.md"?')

      act(() => {
        useDialogStore.getState().answer(true)
      })

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('delete_path', { path: '/root/README.md' })
      })
      expect(readDirectoryCalls()).toBeGreaterThanOrEqual(2)
    })

    it('should warn about cascading delete for folders', async () => {
      render(<FileTree />)
      await screen.findByText('docs')

      fireEvent.contextMenu(screen.getByText('docs'))
      fireEvent.click(await screen.findByText('Delete'))

      expect(useDialogStore.getState().current?.message).toBe(
        'Delete folder "docs" and all its contents?'
      )

      act(() => {
        useDialogStore.getState().answer(true)
      })

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('delete_path', { path: '/root/docs' })
      })
    })

    it('should not delete when confirmation is cancelled', async () => {
      render(<FileTree />)
      await screen.findByText('README.md')

      fireEvent.contextMenu(screen.getByText('README.md'))
      fireEvent.click(await screen.findByText('Delete'))

      act(() => {
        useDialogStore.getState().answer(false)
      })

      await waitFor(() => {
        expect(useDialogStore.getState().current).toBeNull()
      })
      expect(invoke).not.toHaveBeenCalledWith('delete_path', expect.anything())
    })
  })
})
