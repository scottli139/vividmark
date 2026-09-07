import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useEditorStore } from '../../stores/editorStore'
import { saveFile, saveFileAs, openFile, newFile } from '../../lib/fileOps'
import { confirmDialog } from '../../lib/dialog'

// 动作层全部 mock，只验证按键 → 动作的分发（jsdom 无 __TAURI_INTERNALS__，走浏览器分支）
vi.mock('../../lib/fileOps', () => ({
  openFile: vi.fn(),
  openFileSmart: vi.fn(),
  saveFile: vi.fn(),
  saveFileAs: vi.fn(),
  newFile: vi.fn(),
}))
vi.mock('../../lib/dialog', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))
vi.mock('../../lib/clipboard', () => ({
  readClipboardText: vi.fn().mockResolvedValue(null),
  writeClipboardText: vi.fn(),
}))
vi.mock('../../lib/editorActions', () => ({
  openFolderFromPicker: vi.fn(),
  insertImageFromPicker: vi.fn(),
}))

function press(
  key: string,
  opts: { shift?: boolean; alt?: boolean; target?: EventTarget; prevent?: boolean } = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    shiftKey: opts.shift ?? false,
    altKey: opts.alt ?? false,
    bubbles: true,
    cancelable: true,
  })
  if (opts.prevent) event.preventDefault()
  ;(opts.target ?? window).dispatchEvent(event)
  return event
}

describe('useKeyboardShortcuts', () => {
  // setup.ts 把 navigator.platform mock 为 MacIntel（hook 会认 metaKey）；
  // Windows/浏览器快捷键语义是 ctrlKey，这里固定 Win32
  const originalPlatform = navigator.platform

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true })
    useEditorStore.setState({
      isDirty: false,
      showSidebar: true,
      viewMode: 'wysiwyg',
      zoomLevel: 100,
      isSettingsOpen: false,
    })
  })

  afterAll(() => {
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, writable: true })
  })

  it('保存/另存为（含输入框内放行）', () => {
    renderHook(() => useKeyboardShortcuts())
    press('s')
    expect(saveFile).toHaveBeenCalledOnce()

    const input = document.createElement('input')
    document.body.appendChild(input)
    press('s', { shift: true, target: input })
    expect(saveFileAs).toHaveBeenCalledOnce()
    input.remove()
  })

  it('浏览器分支：Ctrl+N 新建文件（脏文档先确认）', async () => {
    useEditorStore.setState({ isDirty: true })
    renderHook(() => useKeyboardShortcuts())
    press('n')
    await vi.waitFor(() => expect(newFile).toHaveBeenCalledOnce())
    expect(confirmDialog).toHaveBeenCalledOnce()
  })

  it('浏览器分支：Ctrl+O 走本窗口 openFile', () => {
    renderHook(() => useKeyboardShortcuts())
    press('o')
    expect(openFile).toHaveBeenCalledOnce()
  })

  it('格式/段落快捷键派发 editor-format', () => {
    const spy = vi.spyOn(window, 'dispatchEvent')
    renderHook(() => useKeyboardShortcuts())

    press('1')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor-format', detail: { format: 'h1' } })
    )
    press('0')
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor-format', detail: { format: 'paragraph' } })
    )
    press('q', { alt: true })
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor-format', detail: { format: 'quote' } })
    )
    press('c', { alt: true })
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'editor-format', detail: { format: 'codeblock' } })
    )
    spy.mockRestore()
  })

  it('修饰键严格匹配：Ctrl+Shift+1 不触发标题', () => {
    const spy = vi.spyOn(window, 'dispatchEvent')
    renderHook(() => useKeyboardShortcuts())
    press('1', { shift: true })
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-format' }))
    spy.mockRestore()
  })

  it('编辑器已处理的键（defaultPrevented）不重复触发', () => {
    const spy = vi.spyOn(window, 'dispatchEvent')
    renderHook(() => useKeyboardShortcuts())
    press('b', { prevent: true })
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-format' }))
    press('z', { prevent: true })
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-undo' }))
    spy.mockRestore()
  })

  it('输入框内不触发文本编辑类快捷键', () => {
    const spy = vi.spyOn(window, 'dispatchEvent')
    renderHook(() => useKeyboardShortcuts())
    const input = document.createElement('input')
    document.body.appendChild(input)

    press('b', { target: input })
    press('1', { target: input })
    press('z', { target: input })
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-format' }))
    expect(spy).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-undo' }))
    input.remove()
    spy.mockRestore()
  })

  it('视图快捷键：侧栏 / 视图模式 / 缩放 / 设置', () => {
    renderHook(() => useKeyboardShortcuts())

    press('b', { shift: true })
    expect(useEditorStore.getState().showSidebar).toBe(false)

    press('2', { alt: true })
    expect(useEditorStore.getState().viewMode).toBe('source')
    press('1', { alt: true })
    expect(useEditorStore.getState().viewMode).toBe('wysiwyg')

    press('=')
    expect(useEditorStore.getState().zoomLevel).toBe(110)
    press('0', { shift: true })
    expect(useEditorStore.getState().zoomLevel).toBe(100)

    press(',')
    expect(useEditorStore.getState().isSettingsOpen).toBe(true)
  })

  it('Ctrl+/ 切换 Source ↔ WYSIWYG', () => {
    renderHook(() => useKeyboardShortcuts())
    press('/')
    expect(useEditorStore.getState().viewMode).toBe('source')
    press('/')
    expect(useEditorStore.getState().viewMode).toBe('wysiwyg')
  })

  it('Ctrl+Z / Ctrl+Shift+Z 派发 editor-undo / editor-redo', () => {
    const spy = vi.spyOn(window, 'dispatchEvent')
    renderHook(() => useKeyboardShortcuts())
    press('z')
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-undo' }))
    press('z', { shift: true })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'editor-redo' }))
    spy.mockRestore()
  })

  it('事件被 preventDefault（快捷键命中后阻止浏览器默认行为）', () => {
    renderHook(() => useKeyboardShortcuts())
    expect(press('=').defaultPrevented).toBe(true)
    // 未绑定的组合不拦截
    expect(press('g').defaultPrevented).toBe(false)
  })
})
