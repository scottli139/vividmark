import { describe, it, expect, vi, beforeEach } from 'vitest'
// 注意：mocks 必须先于 nativeMenu 导入，@tauri-apps/api 的 mock 才能先生效
import { mockInvoke, mockListen } from '../../test/mocks/tauri'
import { handleMenuAction, initNativeMenu } from '../nativeMenu'
import { useEditorStore } from '../../stores/editorStore'
import { newFile, openFile, openFileByPath, saveFile, saveFileAs } from '../fileOps'
import { confirmDialog } from '../dialog'

// fileOps / dialog 全部 mock，只验证分发逻辑
vi.mock('../fileOps', () => ({
  newFile: vi.fn(),
  openFile: vi.fn(),
  openFileByPath: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
}))

vi.mock('../dialog', () => ({
  confirmDialog: vi.fn(),
}))

describe('nativeMenu handleMenuAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useEditorStore.setState({
      isDirty: false,
      showSidebar: true,
      viewMode: 'wysiwyg',
      themeMode: 'system',
      zoomLevel: 100,
      recentFiles: [{ path: '/a/old.md', name: 'old.md', lastOpened: 1 }],
    })
  })

  describe('file 菜单', () => {
    it('file-new：无脏标记直接新建，不弹确认', async () => {
      await handleMenuAction('file-new')
      expect(confirmDialog).not.toHaveBeenCalled()
      expect(newFile).toHaveBeenCalledOnce()
    })

    it('file-new：脏标记 + 确认 → 新建', async () => {
      useEditorStore.setState({ isDirty: true })
      vi.mocked(confirmDialog).mockResolvedValue(true)
      await handleMenuAction('file-new')
      expect(confirmDialog).toHaveBeenCalledOnce()
      expect(newFile).toHaveBeenCalledOnce()
    })

    it('file-new：脏标记 + 取消 → 不新建', async () => {
      useEditorStore.setState({ isDirty: true })
      vi.mocked(confirmDialog).mockResolvedValue(false)
      await handleMenuAction('file-new')
      expect(newFile).not.toHaveBeenCalled()
    })

    it('file-open / file-save / file-save-as 分发到 fileOps', async () => {
      await handleMenuAction('file-open')
      await handleMenuAction('file-save')
      await handleMenuAction('file-save-as')
      expect(openFile).toHaveBeenCalledOnce()
      expect(saveFile).toHaveBeenCalledOnce()
      expect(saveFileAs).toHaveBeenCalledOnce()
    })

    it('open-recent:<path> 解析路径并打开', async () => {
      await handleMenuAction('open-recent:/Users/x/notes/todo.md')
      expect(openFileByPath).toHaveBeenCalledWith('/Users/x/notes/todo.md')
    })

    it('clear-recent 清空最近文件', async () => {
      await handleMenuAction('clear-recent')
      expect(useEditorStore.getState().recentFiles).toEqual([])
    })

    it('export-pdf 派发 editor-request-html', async () => {
      const spy = vi.spyOn(window, 'dispatchEvent')
      await handleMenuAction('export-pdf')
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-request-html' }))
      spy.mockRestore()
    })
  })

  describe('edit 菜单', () => {
    it.each([
      ['edit-undo', 'editor-undo'],
      ['edit-redo', 'editor-redo'],
      ['edit-find', 'editor-find'],
    ])('%s 派发 %s 事件', async (menuId, eventType) => {
      const spy = vi.spyOn(window, 'dispatchEvent')
      await handleMenuAction(menuId)
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: eventType }))
      spy.mockRestore()
    })
  })

  describe('view 菜单', () => {
    it('view-sidebar 切换侧栏', async () => {
      await handleMenuAction('view-sidebar')
      expect(useEditorStore.getState().showSidebar).toBe(false)
    })

    it.each([
      ['view-mode-wysiwyg', 'wysiwyg'],
      ['view-mode-source', 'source'],
      ['view-mode-split', 'split'],
      ['view-mode-preview', 'preview'],
    ] as const)('%s 设置视图模式 %s', async (menuId, mode) => {
      useEditorStore.setState({ viewMode: 'preview' })
      await handleMenuAction(menuId)
      expect(useEditorStore.getState().viewMode).toBe(mode)
    })

    it('zoom-in / zoom-out / zoom-reset', async () => {
      await handleMenuAction('zoom-in')
      expect(useEditorStore.getState().zoomLevel).toBe(110)
      await handleMenuAction('zoom-out')
      await handleMenuAction('zoom-out')
      expect(useEditorStore.getState().zoomLevel).toBe(90)
      await handleMenuAction('zoom-reset')
      expect(useEditorStore.getState().zoomLevel).toBe(100)
    })

    it.each([
      ['theme-light', 'light'],
      ['theme-dark', 'dark'],
      ['theme-system', 'system'],
    ] as const)('%s 设置主题 %s', async (menuId, mode) => {
      await handleMenuAction(menuId)
      expect(useEditorStore.getState().themeMode).toBe(mode)
    })
  })

  describe('其他', () => {
    it('settings 打开设置面板', async () => {
      await handleMenuAction('settings')
      expect(useEditorStore.getState().isSettingsOpen).toBe(true)
    })

    it('未知 id（predefined 项）静默忽略', async () => {
      await expect(handleMenuAction('__tauri_cut__')).resolves.toBeUndefined()
      expect(newFile).not.toHaveBeenCalled()
    })
  })
})

describe('initNativeMenu 状态同步', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // isTauri() 依赖 __TAURI_INTERNALS__
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    mockInvoke.mockResolvedValue(null)
    useEditorStore.setState({
      viewMode: 'source',
      themeMode: 'dark',
      canUndo: true,
      canRedo: false,
      language: 'zh-CN',
      recentFiles: [{ path: '/a/old.md', name: 'old.md', lastOpened: 1 }],
    })
  })

  it('初始化：注册监听 + 全量同步 + 初始重建', async () => {
    const cleanup = await initNativeMenu()
    expect(mockListen).toHaveBeenCalledWith('native-menu-event', expect.any(Function))
    // 初始 check 同步：source✓ / dark✓
    expect(mockInvoke).toHaveBeenCalledWith('set_menu_item_checked', {
      id: 'view-mode-source',
      checked: true,
    })
    expect(mockInvoke).toHaveBeenCalledWith('set_menu_item_checked', {
      id: 'theme-dark',
      checked: true,
    })
    // 初始 enabled 同步
    expect(mockInvoke).toHaveBeenCalledWith('set_menu_item_enabled', {
      id: 'edit-undo',
      enabled: true,
    })
    // 初始重建携带语言与最近文件
    expect(mockInvoke).toHaveBeenCalledWith('rebuild_menu', {
      lang: 'zh-CN',
      recentFiles: [{ name: 'old.md', path: '/a/old.md' }],
    })
    cleanup()
  })

  it('重建完成后按最新状态重新同步 check/enabled（回归：重建会重置为默认勾选）', async () => {
    const cleanup = await initNativeMenu()
    vi.clearAllMocks()

    // 语言变化触发重建
    useEditorStore.setState({ language: 'en' })
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('rebuild_menu', {
        lang: 'en',
        recentFiles: [{ name: 'old.md', path: '/a/old.md' }],
      })
    })
    // rebuild_menu resolve 后必须补一轮 check/enabled 同步
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_menu_item_checked', {
        id: 'view-mode-source',
        checked: true,
      })
      expect(mockInvoke).toHaveBeenCalledWith('set_menu_item_enabled', {
        id: 'edit-undo',
        enabled: true,
      })
    })
    cleanup()
  })

  it('视图模式/主题变化触发 check 同步', async () => {
    const cleanup = await initNativeMenu()
    vi.clearAllMocks()

    useEditorStore.setState({ viewMode: 'split' })
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_menu_item_checked', {
        id: 'view-mode-split',
        checked: true,
      })
      expect(mockInvoke).toHaveBeenCalledWith('set_menu_item_checked', {
        id: 'view-mode-source',
        checked: false,
      })
    })
    cleanup()
  })
})
