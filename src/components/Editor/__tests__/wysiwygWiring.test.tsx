/**
 * WYSIWYG 工具栏/事件总线接线测试
 * - editor-format / editor-insert / editor-undo / editor-redo / editor-scroll-to-heading
 * - viewMode 分流：非激活时 Milkdown 不响应
 * - canUndo/canRedo 按 viewMode 上报
 * - 初始化脏标记守卫：打开文件/初始化不标 dirty
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { editorViewCtx, type Editor } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { WysiwygEditor } from '../WysiwygEditor'
import { useEditorStore } from '../../../stores/editorStore'

const SYNC_TIMEOUT = 1500

describe('wysiwyg event wiring', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: 'hello world\n',
      filePath: null,
      fileName: 'test.md',
      isDirty: false,
      viewMode: 'wysiwyg',
      canUndo: false,
      canRedo: false,
      cursorLine: 1,
      cursorCol: 1,
    })
  })

  function setup(markdown?: string) {
    if (markdown !== undefined) {
      useEditorStore.setState({ content: markdown })
    }
    const editorRef = createRef<Editor | null>()
    const utils = render(<WysiwygEditor editorRef={editorRef} />)
    return { editorRef, ...utils }
  }

  async function waitForEditor(editorRef: React.RefObject<Editor | null>) {
    await waitFor(() => expect(editorRef.current).not.toBeNull())
    return editorRef.current!
  }

  function setSelection(editor: Editor, from: number, to = from) {
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)))
    })
  }

  function fireFormat(format: string) {
    act(() => {
      window.dispatchEvent(new CustomEvent('editor-format', { detail: { format } }))
    })
  }

  it('editor-format bold wraps selection with strong mark', async () => {
    const editor = await waitForEditor(setup().editorRef)
    // 选中 "hello"（pos 1..6）
    setSelection(editor, 1, 6)

    fireFormat('bold')

    await waitFor(
      () => {
        expect(useEditorStore.getState().content).toContain('**hello**')
      },
      { timeout: SYNC_TIMEOUT }
    )
    expect(editor.action(getMarkdown())).toContain('**hello**')
  })

  it('editor-format h1 turns paragraph into heading (and toggles back)', async () => {
    const editor = await waitForEditor(setup().editorRef)
    setSelection(editor, 2)

    fireFormat('h1')
    expect(editor.action(getMarkdown())).toMatch(/^# hello world/)

    fireFormat('h1')
    expect(editor.action(getMarkdown())).not.toMatch(/^# /)
  })

  it('editor-format link without selection inserts placeholder link and selects it', async () => {
    const editor = await waitForEditor(setup().editorRef)
    // 光标放文档末尾
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.dispatch(
        view.state.tr.setSelection(
          TextSelection.near(view.state.doc.resolve(view.state.doc.content.size))
        )
      )
    })

    fireFormat('link')

    expect(editor.action(getMarkdown())).toContain('[link text](url)')
    // 占位文本被选中
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { from, to } = view.state.selection
      expect(view.state.doc.textBetween(from, to)).toBe('link text')
    })
  })

  it('editor-format tasklist wraps paragraph into a task item', async () => {
    const editor = await waitForEditor(setup().editorRef)
    setSelection(editor, 2)

    fireFormat('tasklist')

    expect(editor.action(getMarkdown())).toMatch(/[*-] \[ \] hello world/)
  })

  it('editor-insert parses table markdown into a table node and focuses first cell', async () => {
    const editor = await waitForEditor(setup('').editorRef)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('editor-insert', { detail: { text: '| a | b |\n| - | - |\n| 1 | 2 |' } })
      )
    })

    const doc = editor.action((ctx) => ctx.get(editorViewCtx).state.doc)
    let hasTable = false
    doc.descendants((node) => {
      if (node.type.name === 'table') hasTable = true
    })
    expect(hasTable).toBe(true)
    // 光标在表格节点内部（首单元格）
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      let insideTable = false
      view.state.doc.nodesBetween(0, view.state.selection.from, (node, pos) => {
        if (node.type.name === 'table' && pos < view.state.selection.from) insideTable = true
      })
      expect(insideTable).toBe(true)
    })
  })

  it('editor-undo / editor-redo drive PM history and store flags', async () => {
    const editor = await waitForEditor(setup().editorRef)

    // 用户编辑
    act(() => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        view.dispatch(view.state.tr.insertText('X', 1))
      })
    })
    expect(useEditorStore.getState().canUndo).toBe(true)

    act(() => {
      window.dispatchEvent(new CustomEvent('editor-undo'))
    })
    expect(editor.action(getMarkdown())).not.toContain('Xhello')
    expect(useEditorStore.getState().canRedo).toBe(true)

    act(() => {
      window.dispatchEvent(new CustomEvent('editor-redo'))
    })
    expect(editor.action(getMarkdown())).toContain('Xhello')
  })

  it('editor-scroll-to-heading moves selection to the Nth heading', async () => {
    const editor = await waitForEditor(setup('# One\n\ntext\n\n## Two\n\nmore\n').editorRef)

    act(() => {
      window.dispatchEvent(
        new CustomEvent('editor-scroll-to-heading', {
          detail: { index: 1, charIndex: 0, lineIndex: 0 },
        })
      )
    })

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const $from = view.state.selection.$from
      // 光标落在第二个标题（## Two）内
      expect($from.parent.type.name).toBe('heading')
      expect($from.parent.textContent).toBe('Two')
    })
  })

  it('does not respond to events when wysiwyg is not active', async () => {
    const editor = await waitForEditor(setup().editorRef)
    act(() => {
      useEditorStore.getState().setViewMode('source')
    })

    fireFormat('bold')
    act(() => {
      window.dispatchEvent(new CustomEvent('editor-undo'))
    })

    expect(editor.action(getMarkdown())).toBe('hello world\n')
  })

  it('does not mark a freshly opened document dirty (init/normalize guard)', async () => {
    // 模拟打开文件：非规范化内容（- 列表、裸 URL），isDirty=false
    useEditorStore.setState({
      content: '- item one\n- item two\n\nhttps://example.com\n',
      filePath: '/docs/note.md',
      isDirty: false,
      viewMode: 'wysiwyg',
    })
    render(<WysiwygEditor />)

    // 等待超过 listener 的 200ms 防抖窗口
    await new Promise((resolve) => setTimeout(resolve, 400))

    // 初始化/规范化不得回写 store、不得标 dirty
    expect(useEditorStore.getState().isDirty).toBe(false)
    expect(useEditorStore.getState().content).toBe(
      '- item one\n- item two\n\nhttps://example.com\n'
    )
  })

  it('does not mark document dirty when switching into wysiwyg with clean content', async () => {
    useEditorStore.setState({
      content: '- a\n- b\n',
      filePath: '/docs/note.md',
      isDirty: false,
      viewMode: 'source',
    })
    render(<WysiwygEditor />)

    act(() => {
      useEditorStore.getState().setViewMode('wysiwyg')
    })
    await new Promise((resolve) => setTimeout(resolve, 400))

    expect(useEditorStore.getState().isDirty).toBe(false)
  })
})
