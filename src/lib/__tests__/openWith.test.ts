import { describe, it, expect, vi, beforeEach } from 'vitest'
// 注意：mocks 必须先于被测模块导入，@tauri-apps/api 的 mock 才能先生效
import { mockInvoke, mockListen } from '../../test/mocks/tauri'
import { initOpenWith } from '../openWith'
import { useEditorStore } from '../../stores/editorStore'
import { openFileByPath } from '../fileOps'
import { confirmDialog } from '../dialog'

vi.mock('../fileOps', () => ({
  openFileByPath: vi.fn(),
}))

vi.mock('../dialog', () => ({
  confirmDialog: vi.fn(),
}))

describe('openWith 文件关联打开', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // isTauri() 依赖 __TAURI_INTERNALS__
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    mockInvoke.mockResolvedValue([])
    useEditorStore.setState({ isDirty: false })
  })

  it('初始化：注册监听 + 取走冷启动积压路径并打开', async () => {
    mockInvoke.mockResolvedValue(['/a/first.md', '/b/second.md'])
    const cleanup = await initOpenWith()

    expect(mockListen).toHaveBeenCalledWith('file-open-request', expect.any(Function))
    expect(mockInvoke).toHaveBeenCalledWith('take_startup_open_files')
    expect(openFileByPath).toHaveBeenCalledWith('/a/first.md')
    expect(openFileByPath).toHaveBeenCalledWith('/b/second.md')
    cleanup()
  })

  it('事件到达：打开 payload 路径（Rust 已定向到本窗口，不触碰启动队列）', async () => {
    let handler: ((event: { payload: string[] }) => void) | undefined
    mockListen.mockImplementation((_event: string, cb: unknown) => {
      handler = cb as typeof handler
      return Promise.resolve(() => {})
    })

    const cleanup = await initOpenWith()
    expect(handler).toBeDefined()

    handler!({ payload: ['/c/warm.md'] })
    await vi.waitFor(() => {
      expect(openFileByPath).toHaveBeenCalledWith('/c/warm.md')
    })
    // 热路径：初始化时按 label 取走一次；事件到达时再全清一次幽灵队列（HMR 防御）
    expect(mockInvoke).not.toHaveBeenCalledWith('take_pending_open_files')
    const takeCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'take_startup_open_files')
    expect(takeCalls).toHaveLength(2)
    expect(takeCalls[1][1]).toEqual({ label: null })
    cleanup()
  })

  it('脏文档：确认放弃后才打开', async () => {
    useEditorStore.setState({ isDirty: true })
    vi.mocked(confirmDialog).mockResolvedValue(false)
    mockInvoke.mockResolvedValue(['/a/first.md'])

    const cleanup = await initOpenWith()
    await vi.waitFor(() => {
      expect(confirmDialog).toHaveBeenCalled()
    })
    expect(openFileByPath).not.toHaveBeenCalled()
    cleanup()
  })

  it('非 Tauri 环境为 no-op', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    vi.clearAllMocks()

    const cleanup = await initOpenWith()
    expect(mockListen).not.toHaveBeenCalled()
    expect(mockInvoke).not.toHaveBeenCalled()
    cleanup()
  })
})
