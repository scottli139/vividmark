import { describe, it, expect, vi, beforeEach } from 'vitest'
// 注意：mocks 必须先于被测模块导入
import { mockInvoke, mockListen, mockOnCloseRequested } from '../../test/mocks/tauri'
import { initWindowManager } from '../windowManager'
import { useEditorStore } from '../../stores/editorStore'
import { confirmDialog } from '../dialog'

vi.mock('../dialog', () => ({
  confirmDialog: vi.fn(),
}))

/** 捕获 prefs-sync 事件监听回调 */
function capturePrefsHandler(): (event: {
  payload: { themeMode: string; language: string; recentFiles: unknown[] }
}) => void {
  const call = mockListen.mock.calls.find((c) => c[0] === 'prefs-sync')
  expect(call).toBeDefined()
  return call![1] as ReturnType<typeof capturePrefsHandler>
}

describe('windowManager 多窗口管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue(null)
    mockListen.mockResolvedValue(vi.fn())
    mockOnCloseRequested.mockResolvedValue(vi.fn())
    // isTauri() 依赖 __TAURI_INTERNALS__
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    useEditorStore.setState({
      filePath: null,
      isDirty: false,
      themeMode: 'system',
      language: 'en',
      recentFiles: [],
    })
  })

  it('初始化上报窗口状态；filePath/isDirty 变化时再上报', async () => {
    const cleanup = await initWindowManager()
    expect(mockInvoke).toHaveBeenCalledWith('report_window_state', { path: null, dirty: false })

    useEditorStore.setState({ filePath: '/a/x.md', isDirty: true })
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('report_window_state', {
        path: '/a/x.md',
        dirty: true,
      })
    })
    cleanup()
  })

  it('prefs-sync 事件同步 themeMode / language / recentFiles', async () => {
    const cleanup = await initWindowManager()
    const handler = capturePrefsHandler()
    const recent = [{ path: '/a.md', name: 'a.md', lastOpened: 1 }]

    handler({ payload: { themeMode: 'dark', language: 'zh-CN', recentFiles: recent } })

    const state = useEditorStore.getState()
    expect(state.themeMode).toBe('dark')
    expect(state.language).toBe('zh-CN')
    expect(state.recentFiles).toEqual(recent)
    cleanup()
  })

  it('prefs-sync 防回声：相同值不触发 set', async () => {
    useEditorStore.setState({ themeMode: 'dark' })
    const setThemeModeSpy = vi.spyOn(useEditorStore.getState(), 'setThemeMode')
    const cleanup = await initWindowManager()
    const handler = capturePrefsHandler()

    handler({
      payload: { themeMode: 'dark', language: 'en', recentFiles: [] },
    })
    expect(setThemeModeSpy).not.toHaveBeenCalled()
    cleanup()
  })

  it('本窗口偏好变化经 emit 广播（其他窗口据此同步）', async () => {
    const { mockEmit } = await import('../../test/mocks/tauri')
    const cleanup = await initWindowManager()

    useEditorStore.getState().setThemeMode('dark')
    await vi.waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith(
        'prefs-sync',
        expect.objectContaining({ themeMode: 'dark' })
      )
    })
    cleanup()
  })

  it('脏文档关闭：取消确认则阻止关闭', async () => {
    useEditorStore.setState({ isDirty: true })
    vi.mocked(confirmDialog).mockResolvedValue(false)

    let closeHandler: ((event: { preventDefault: () => void }) => Promise<void>) | undefined
    mockOnCloseRequested.mockImplementation((cb: unknown) => {
      closeHandler = cb as typeof closeHandler
      return Promise.resolve(vi.fn())
    })

    const cleanup = await initWindowManager()
    const preventDefault = vi.fn()
    await closeHandler!({ preventDefault })
    expect(preventDefault).toHaveBeenCalled()
    cleanup()
  })

  it('脏文档关闭：确认后放行；干净文档不拦截', async () => {
    let closeHandler: ((event: { preventDefault: () => void }) => Promise<void>) | undefined
    mockOnCloseRequested.mockImplementation((cb: unknown) => {
      closeHandler = cb as typeof closeHandler
      return Promise.resolve(vi.fn())
    })

    useEditorStore.setState({ isDirty: true })
    vi.mocked(confirmDialog).mockResolvedValue(true)
    const cleanup = await initWindowManager()

    const preventDefault = vi.fn()
    await closeHandler!({ preventDefault })
    expect(preventDefault).not.toHaveBeenCalled()

    // 干净文档：不弹确认直接放行
    useEditorStore.setState({ isDirty: false })
    vi.mocked(confirmDialog).mockClear()
    await closeHandler!({ preventDefault: vi.fn() })
    expect(confirmDialog).not.toHaveBeenCalled()
    cleanup()
  })

  it('非 Tauri 环境为 no-op', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    vi.clearAllMocks()

    const cleanup = await initWindowManager()
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(mockOnCloseRequested).not.toHaveBeenCalled()
    cleanup()
  })
})
