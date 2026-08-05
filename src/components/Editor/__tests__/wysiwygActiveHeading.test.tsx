/**
 * WYSIWYG 当前标题跟随测试
 * - wysiwygActiveHeadingPlugin：selection/doc 变化 → store.activeHeadingIndex
 * - findActiveHeadingIndex 纯函数边界（pos 在首个 heading 之前 → null）
 * - viewMode 分流：非 wysiwyg 激活时 plugin 不写 store
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { editorViewCtx, type Editor } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import { WysiwygEditor } from '../WysiwygEditor'
import { findActiveHeadingIndex } from '../wysiwygActiveHeadingPlugin'
import { useEditorStore } from '../../../stores/editorStore'

describe('wysiwyg active heading', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: 'intro\n\n# One\n\ntext\n\n## Two\n\nmore\n',
      filePath: null,
      fileName: 'test.md',
      isDirty: false,
      viewMode: 'wysiwyg',
      activeHeadingIndex: null,
    })
  })

  function setup() {
    const editorRef = createRef<Editor | null>()
    render(<WysiwygEditor editorRef={editorRef} />)
    return editorRef
  }

  async function waitForEditor(editorRef: React.RefObject<Editor | null>) {
    await waitFor(() => expect(editorRef.current).not.toBeNull())
    return editorRef.current!
  }

  function setSelection(editor: Editor, pos: number) {
    act(() => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
      })
    })
  }

  /** 找指定类型与文本的块级节点位置 */
  function blockPos(editor: Editor, type: string, text: string): number {
    return editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      let found = -1
      view.state.doc.descendants((node, nodePos) => {
        if (found < 0 && node.type.name === type && node.textContent === text) {
          found = nodePos
        }
        return true
      })
      return found
    })
  }

  it('starts with null when selection is before the first heading', async () => {
    const editor = await waitForEditor(setup())

    // 创建后初始 selection 在文档开头（intro 段之前），第一个 heading 之前 → null
    expect(useEditorStore.getState().activeHeadingIndex).toBeNull()

    setSelection(editor, 1) // intro 段内
    expect(useEditorStore.getState().activeHeadingIndex).toBeNull()
  })

  it('tracks the heading containing or preceding the selection', async () => {
    const editor = await waitForEditor(setup())
    const onePos = blockPos(editor, 'heading', 'One')
    const twoPos = blockPos(editor, 'heading', 'Two')
    expect(onePos).toBeGreaterThan(0)
    expect(twoPos).toBeGreaterThan(onePos)

    setSelection(editor, onePos + 1) // 进入 # One
    expect(useEditorStore.getState().activeHeadingIndex).toBe(0)

    setSelection(editor, twoPos + 1) // 进入 ## Two
    expect(useEditorStore.getState().activeHeadingIndex).toBe(1)

    setSelection(editor, 1) // 移回第一个 heading 之前
    expect(useEditorStore.getState().activeHeadingIndex).toBeNull()
  })

  it('keeps the previous heading while the cursor is in body text after it', async () => {
    const editor = await waitForEditor(setup())

    setSelection(editor, blockPos(editor, 'paragraph', 'text') + 1) // # One 之后、## Two 之前
    expect(useEditorStore.getState().activeHeadingIndex).toBe(0)

    setSelection(editor, blockPos(editor, 'paragraph', 'more') + 1) // ## Two 之后
    expect(useEditorStore.getState().activeHeadingIndex).toBe(1)
  })

  it('does not write the store while wysiwyg is not the active mode', async () => {
    const editor = await waitForEditor(setup())
    const twoPos = blockPos(editor, 'heading', 'Two')

    act(() => {
      useEditorStore.getState().setViewMode('source')
    })
    act(() => {
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, twoPos + 1)))
      })
    })

    expect(useEditorStore.getState().activeHeadingIndex).toBeNull()
  })

  it('findActiveHeadingIndex counts headings strictly before pos', async () => {
    const editor = await waitForEditor(setup())
    const doc = editor.action((ctx) => ctx.get(editorViewCtx).state.doc)
    const twoPos = blockPos(editor, 'heading', 'Two')

    expect(findActiveHeadingIndex(doc, 0)).toBeNull() // 文档开头（首个 heading 之前）
    expect(findActiveHeadingIndex(doc, twoPos)).toBe(0) // pos 恰在第二标题起点 → 尚未进入
    expect(findActiveHeadingIndex(doc, twoPos + 1)).toBe(1) // 进入 ## Two
    expect(findActiveHeadingIndex(doc, doc.content.size)).toBe(1) // 文档末尾
  })
})
