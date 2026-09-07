import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MenuBar } from '../MenuBar'
import { useEditorStore } from '../../../stores/editorStore'
import { handleMenuAction } from '../../../lib/nativeMenu'

// 分发层 stub：只验证 id 透传，真实分发由 nativeMenu.test.ts 覆盖
vi.mock('../../../lib/nativeMenu', () => ({
  handleMenuAction: vi.fn(() => Promise.resolve()),
}))

const mockedHandleMenuAction = vi.mocked(handleMenuAction)

describe('MenuBar', () => {
  beforeEach(() => {
    useEditorStore.setState({
      viewMode: 'wysiwyg',
      themeMode: 'system',
      sidebarTab: 'outline',
      canUndo: false,
      canRedo: false,
      filePath: null,
      openedFolder: null,
      recentFiles: [],
    })
  })

  afterEach(() => {
    useEditorStore.setState({ viewMode: 'wysiwyg', recentFiles: [] })
  })

  it('渲染七个顶级菜单（File/Edit/Paragraph/Format/View/Window/Help）', () => {
    render(<MenuBar />)
    const bar = screen.getByTestId('menu-bar')
    for (const label of ['File', 'Edit', 'Paragraph', 'Format', 'View', 'Window', 'Help']) {
      expect(bar).toHaveTextContent(label)
    }
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('点击打开下拉面板，面板左缘与菜单项对齐（left-0 top-full）', () => {
    render(<MenuBar />)
    fireEvent.click(screen.getByRole('button', { name: 'File' }))

    const panel = screen.getByRole('menu')
    expect(panel.className).toContain('left-0')
    expect(panel.className).toContain('top-full')
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Open…')).toBeInTheDocument()
  })

  it('打开后 hover 平移切换到相邻菜单', () => {
    render(<MenuBar />)
    fireEvent.click(screen.getByRole('button', { name: 'File' }))
    expect(screen.getByText('New')).toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.queryByText('New')).not.toBeInTheDocument()
    expect(screen.getByText('Undo')).toBeInTheDocument()
  })

  it('未打开时 hover 不打开菜单', () => {
    render(<MenuBar />)
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('再次点击同一菜单项关闭', () => {
    render(<MenuBar />)
    const trigger = screen.getByRole('button', { name: 'File' })
    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Escape / 外部点击关闭', () => {
    render(<MenuBar />)
    const trigger = screen.getByRole('button', { name: 'View' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('选择菜单项：透传 id 给 handleMenuAction 并关闭', () => {
    render(<MenuBar />)
    fireEvent.click(screen.getByRole('button', { name: 'File' }))
    fireEvent.click(screen.getByText('Save'))

    expect(mockedHandleMenuAction).toHaveBeenCalledWith('file-save')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('勾选态跟随 store（viewMode=source 时 Source 打勾）', () => {
    useEditorStore.setState({ viewMode: 'source' })
    render(<MenuBar />)
    fireEvent.click(screen.getByRole('button', { name: 'View' }))

    expect(screen.getByRole('menuitemcheckbox', { name: /Source/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('menuitemcheckbox', { name: /WYSIWYG/ })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('禁用项不分发（canUndo=false 时 Undo 禁用）', () => {
    render(<MenuBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByText('Undo'))

    expect(mockedHandleMenuAction).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('Open Recent 子菜单动态渲染最近文件并可点选', () => {
    useEditorStore.setState({
      recentFiles: [{ name: 'note.md', path: '/docs/note.md', lastOpened: 1 }],
    })
    render(<MenuBar />)
    fireEvent.click(screen.getByRole('button', { name: 'File' }))
    fireEvent.mouseEnter(screen.getByText('Open Recent'))
    fireEvent.click(screen.getByText('note.md'))

    expect(mockedHandleMenuAction).toHaveBeenCalledWith('open-recent:/docs/note.md')
  })

  it('Help ▸ About 分发 help-about', () => {
    render(<MenuBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    fireEvent.click(screen.getByText('About VividMark'))

    expect(mockedHandleMenuAction).toHaveBeenCalledWith('help-about')
  })
})
