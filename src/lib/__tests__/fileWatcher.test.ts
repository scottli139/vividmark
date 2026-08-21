import { describe, it, expect, vi, beforeEach } from 'vitest'
// 注意：mocks 必须先于被测模块导入
import { mockInvoke, mockListen } from '../../test/mocks/tauri'
import {
  decideWatchAction,
  initFileWatcher,
  markFileContentKnown,
  isWatchConflictPending,
  resetFileWatcherState,
} from '../fileWatcher'
import { useEditorStore } from '../../stores/editorStore'
import { useDialogStore } from '../../stores/dialogStore'

/** 捕获 file-watch-event 监听回调 */
function captureWatchHandler(): (event: {
  payload: { path: string; kind: 'changed' | 'removed' }
}) => void {
  const call = mockListen.mock.calls.find((c) => c[0] === 'file-watch-event')
  expect(call).toBeDefined()
  return call![1] as ReturnType<typeof captureWatchHandler>
}

/** 用可变变量模拟磁盘内容 */
function mockDisk(initial: string) {
  const disk = { content: initial }
  mockInvoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'read_file') return { path: '/a.md', content: disk.content, name: 'a.md' }
    return null
  })
  return disk
}

describe('decideWatchAction 纯决策', () => {
  const base = {
    kind: 'changed' as const,
    diskContent: 'v2',
    lastKnown: 'v1',
    isDirty: false,
    conflictPending: false,
    removedNotified: false,
  }

  it('冲突弹窗未决：一律忽略（解决路径会重读磁盘）', () => {
    expect(decideWatchAction({ ...base, conflictPending: true })).toBe('ignore')
    expect(decideWatchAction({ ...base, kind: 'removed', conflictPending: true })).toBe('ignore')
  })

  it('外部删除：首次提示，已提示过则忽略', () => {
    expect(decideWatchAction({ ...base, kind: 'removed' })).toBe('deleted')
    expect(decideWatchAction({ ...base, kind: 'removed', removedNotified: true })).toBe('ignore')
  })

  it('自己保存的回声（磁盘 == 最后已知）：忽略', () => {
    expect(decideWatchAction({ ...base, diskContent: 'v1' })).toBe('ignore')
  })

  it('外部修改 + 干净缓冲区 → 静默重载；脏缓冲区 → 冲突', () => {
    expect(decideWatchAction(base)).toBe('reload')
    expect(decideWatchAction({ ...base, isDirty: true })).toBe('conflict')
  })
})

describe('fileWatcher 事件流', () => {
  beforeEach(() => {
    resetFileWatcherState()
    mockListen.mockResolvedValue(vi.fn())
    // isTauri() 依赖 __TAURI_INTERNALS__
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
    useEditorStore.setState({
      content: 'v1',
      filePath: '/a.md',
      fileName: 'a.md',
      isDirty: false,
    })
    useDialogStore.setState({ current: null })
  })

  it('初始化监听当前文档；filePath 变化时切换/停止 watcher', async () => {
    mockInvoke.mockResolvedValue(null)
    const cleanup = await initFileWatcher()
    expect(mockInvoke).toHaveBeenCalledWith('watch_file', { path: '/a.md' })

    useEditorStore.setState({ filePath: '/b.md' })
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('watch_file', { path: '/b.md' })
    })

    useEditorStore.setState({ filePath: null })
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('unwatch_file')
    })
    cleanup()
  })

  it('干净缓冲区 + 外部修改 → 静默重载并保持干净', async () => {
    mockDisk('v2-external')
    const cleanup = await initFileWatcher()
    markFileContentKnown('v1')

    captureWatchHandler()({ payload: { path: '/a.md', kind: 'changed' } })
    await vi.waitFor(() => {
      expect(useEditorStore.getState().content).toBe('v2-external')
    })
    expect(useEditorStore.getState().isDirty).toBe(false)
    expect(useDialogStore.getState().current).toBeNull()
    cleanup()
  })

  it('回声抑制：磁盘内容 == 最后已知时不弹窗不重载', async () => {
    const disk = mockDisk('v1')
    const cleanup = await initFileWatcher()
    markFileContentKnown('v1')

    captureWatchHandler()({ payload: { path: '/a.md', kind: 'changed' } })
    await vi.waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('read_file', { path: '/a.md' })
    })
    expect(useEditorStore.getState().content).toBe('v1')
    expect(useEditorStore.getState().isDirty).toBe(false)
    expect(useDialogStore.getState().current).toBeNull()
    expect(disk.content).toBe('v1')
    cleanup()
  })

  it('非当前文档路径的事件直接忽略', async () => {
    mockDisk('v2')
    const cleanup = await initFileWatcher()

    captureWatchHandler()({ payload: { path: '/other.md', kind: 'changed' } })
    // 等一个事件循环确认没有读盘
    await new Promise((r) => setTimeout(r, 10))
    expect(mockInvoke).not.toHaveBeenCalledWith('read_file', expect.anything())
    expect(useEditorStore.getState().content).toBe('v1')
    cleanup()
  })

  it('脏缓冲区 + 外部修改 → 冲突弹窗（自定义按钮），选重新加载则读最新磁盘版', async () => {
    const disk = mockDisk('v2-external')
    useEditorStore.setState({ isDirty: true, content: 'v1-mine' })
    const cleanup = await initFileWatcher()
    markFileContentKnown('v1')

    captureWatchHandler()({ payload: { path: '/a.md', kind: 'changed' } })
    await vi.waitFor(() => {
      const current = useDialogStore.getState().current
      expect(current?.kind).toBe('confirm')
      expect(current?.confirmLabel).toBeTruthy()
      expect(current?.cancelLabel).toBeTruthy()
    })
    expect(isWatchConflictPending()).toBe(true)

    // 弹窗期间外部又改了一版——重新加载应拿到最新磁盘内容
    disk.content = 'v3-newer'
    useDialogStore.getState().answer(true)
    await vi.waitFor(() => {
      expect(useEditorStore.getState().content).toBe('v3-newer')
    })
    expect(useEditorStore.getState().isDirty).toBe(false)
    expect(isWatchConflictPending()).toBe(false)
    cleanup()
  })

  it('冲突选保留我的更改：内容不动，磁盘现状记为已知（同事件不再弹）', async () => {
    mockDisk('v2-external')
    useEditorStore.setState({ isDirty: true, content: 'v1-mine' })
    const cleanup = await initFileWatcher()
    markFileContentKnown('v1')

    const handler = captureWatchHandler()
    handler({ payload: { path: '/a.md', kind: 'changed' } })
    await vi.waitFor(() => {
      expect(useDialogStore.getState().current?.kind).toBe('confirm')
    })

    useDialogStore.getState().answer(false)
    await vi.waitFor(() => {
      expect(isWatchConflictPending()).toBe(false)
    })
    expect(useEditorStore.getState().content).toBe('v1-mine')
    expect(useEditorStore.getState().isDirty).toBe(true)

    // 同一外部版本再次触发（编辑器常见的多步写盘）→ 不再弹窗
    handler({ payload: { path: '/a.md', kind: 'changed' } })
    await new Promise((r) => setTimeout(r, 10))
    expect(useDialogStore.getState().current).toBeNull()
    cleanup()
  })

  it('冲突未决期间后续事件直接忽略（不重复读盘）', async () => {
    mockDisk('v2-external')
    useEditorStore.setState({ isDirty: true })
    const cleanup = await initFileWatcher()
    markFileContentKnown('v1')

    const handler = captureWatchHandler()
    handler({ payload: { path: '/a.md', kind: 'changed' } })
    await vi.waitFor(() => {
      expect(useDialogStore.getState().current?.kind).toBe('confirm')
    })
    const readCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'read_file').length

    handler({ payload: { path: '/a.md', kind: 'changed' } })
    await new Promise((r) => setTimeout(r, 10))
    expect(mockInvoke.mock.calls.filter((c) => c[0] === 'read_file').length).toBe(readCalls)

    useDialogStore.getState().answer(false)
    cleanup()
  })

  it('外部删除：提示一次；保存重建后可再次提示', async () => {
    mockInvoke.mockResolvedValue(null)
    const cleanup = await initFileWatcher()

    const handler = captureWatchHandler()
    handler({ payload: { path: '/a.md', kind: 'removed' } })
    await vi.waitFor(() => {
      expect(useDialogStore.getState().current?.kind).toBe('alert')
    })
    useDialogStore.getState().answer(true)

    // 重复删除事件不再提示
    handler({ payload: { path: '/a.md', kind: 'removed' } })
    await new Promise((r) => setTimeout(r, 10))
    expect(useDialogStore.getState().current).toBeNull()

    // 保存重建文件后，再次删除应重新提示
    markFileContentKnown('v1')
    handler({ payload: { path: '/a.md', kind: 'removed' } })
    await vi.waitFor(() => {
      expect(useDialogStore.getState().current?.kind).toBe('alert')
    })
    useDialogStore.getState().answer(true)
    cleanup()
  })

  it('非 Tauri 环境为 no-op', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    vi.clearAllMocks()

    const cleanup = await initFileWatcher()
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(mockListen).not.toHaveBeenCalled()
    cleanup()
  })
})
