import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import type { EditorView } from '@codemirror/view'
import { CodeMirrorEditor } from '../CodeMirrorEditor'
import { useEditorStore } from '../../../stores/editorStore'

// Mock imageUtils 依赖的 Tauri API（粘贴/拖拽图片路径）
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  copyFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/')),
  dirname: vi.fn((path: string) => path.substring(0, path.lastIndexOf('/'))),
  basename: vi.fn((path: string) => path.split('/').pop() || ''),
}))

const INITIAL_CONTENT = '# Hello\n\nworld'

describe('CodeMirrorEditor', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: INITIAL_CONTENT,
      filePath: null,
      fileName: 'test.md',
      isDirty: false,
      viewMode: 'source',
      canUndo: false,
      canRedo: false,
      cursorLine: 1,
      cursorCol: 1,
    })
  })

  function setup() {
    const viewRef = createRef<EditorView | null>()
    const utils = render(<CodeMirrorEditor viewRef={viewRef} />)
    return { viewRef, ...utils }
  }

  it('should render CodeMirror with store content', () => {
    const { container, viewRef } = setup()

    expect(container.querySelector('.cm-editor')).toBeInTheDocument()
    expect(viewRef.current?.state.doc.toString()).toBe(INITIAL_CONTENT)
  })

  it('should sync CM edits to store (without loop-back)', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    const docBefore = view.state.doc.toString()
    act(() => {
      view.dispatch({ changes: { from: 0, insert: 'X' } })
    })

    expect(useEditorStore.getState().content).toBe('X' + docBefore)
    // 回环检查：store 更新后 CM 文档不被重写（长度只增加一次）
    expect(view.state.doc.toString()).toBe('X' + docBefore)
  })

  it('should sync external store changes into CM', async () => {
    const { viewRef } = setup()

    act(() => {
      useEditorStore.getState().setContent('# Replaced')
    })

    await waitFor(() => {
      expect(viewRef.current?.state.doc.toString()).toBe('# Replaced')
    })
  })

  it('should handle editor-format event (bold with selection)', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    // 选中 "Hello"（文档 '# Hello\n\nworld' 的 2..7）
    act(() => {
      view.dispatch({ selection: { anchor: 2, head: 7 } })
    })
    act(() => {
      window.dispatchEvent(new CustomEvent('editor-format', { detail: { format: 'bold' } }))
    })

    expect(useEditorStore.getState().content).toBe('# **Hello**\n\nworld')
  })

  it('should handle editor-format event (bold without selection inserts placeholder)', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    act(() => {
      view.dispatch({ selection: { anchor: 0 } })
    })
    act(() => {
      window.dispatchEvent(new CustomEvent('editor-format', { detail: { format: 'bold' } }))
    })

    expect(useEditorStore.getState().content).toBe('**bold text**# Hello\n\nworld')
    // 占位词被选中
    expect(view.state.selection.main.anchor).toBe(2)
    expect(view.state.selection.main.head).toBe(11)
  })

  it('should handle editor-format event (heading toggle)', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    // 光标放到第二段 "world" 行
    act(() => {
      view.dispatch({ selection: { anchor: 10 } })
    })
    act(() => {
      window.dispatchEvent(new CustomEvent('editor-format', { detail: { format: 'h2' } }))
    })

    expect(useEditorStore.getState().content).toBe('# Hello\n\n## world')
  })

  it('should handle editor-insert event', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    act(() => {
      view.dispatch({ selection: { anchor: 0 } })
    })
    act(() => {
      window.dispatchEvent(
        new CustomEvent('editor-insert', { detail: { text: '![img](./assets/a.png)' } })
      )
    })

    expect(useEditorStore.getState().content).toBe('![img](./assets/a.png)# Hello\n\nworld')
  })

  it('should update canUndo/canRedo in store', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    expect(useEditorStore.getState().canUndo).toBe(false)

    act(() => {
      view.dispatch({ changes: { from: 0, insert: 'X' } })
    })
    expect(useEditorStore.getState().canUndo).toBe(true)
    expect(useEditorStore.getState().canRedo).toBe(false)
  })

  it('should handle editor-undo / editor-redo events', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    act(() => {
      view.dispatch({ changes: { from: 0, insert: 'X' } })
    })
    expect(useEditorStore.getState().content).toBe('X' + INITIAL_CONTENT)

    act(() => {
      window.dispatchEvent(new CustomEvent('editor-undo'))
    })
    expect(useEditorStore.getState().content).toBe(INITIAL_CONTENT)
    expect(useEditorStore.getState().canRedo).toBe(true)

    act(() => {
      window.dispatchEvent(new CustomEvent('editor-redo'))
    })
    expect(useEditorStore.getState().content).toBe('X' + INITIAL_CONTENT)
  })

  it('should report cursor line/col to store', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    // 文档 '# Hello\n\nworld'：pos 10 在第 3 行第 2 列
    act(() => {
      view.dispatch({ selection: { anchor: 10 } })
    })

    expect(useEditorStore.getState().cursorLine).toBe(3)
    expect(useEditorStore.getState().cursorCol).toBe(2)
  })

  it('should move selection on editor-scroll-to-heading in source mode', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    act(() => {
      window.dispatchEvent(
        new CustomEvent('editor-scroll-to-heading', {
          detail: { charIndex: 9, lineIndex: 2, index: 0 },
        })
      )
    })

    expect(view.state.selection.main.head).toBe(9)
  })

  it('should ignore editor-scroll-to-heading in preview mode', () => {
    useEditorStore.setState({ viewMode: 'preview' })
    const { viewRef } = setup()
    const view = viewRef.current!

    act(() => {
      view.dispatch({ selection: { anchor: 0 } })
    })
    act(() => {
      window.dispatchEvent(
        new CustomEvent('editor-scroll-to-heading', {
          detail: { charIndex: 9, lineIndex: 2, index: 0 },
        })
      )
    })

    expect(view.state.selection.main.head).toBe(0)
  })

  it('should clamp out-of-range charIndex when scrolling to heading', () => {
    const { viewRef } = setup()
    const view = viewRef.current!

    act(() => {
      window.dispatchEvent(
        new CustomEvent('editor-scroll-to-heading', {
          detail: { charIndex: 9999, lineIndex: 99, index: 0 },
        })
      )
    })

    expect(view.state.selection.main.head).toBe(INITIAL_CONTENT.length)
  })
})
