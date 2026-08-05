import { describe, it, expect, beforeEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { editorViewCtx, type Editor } from '@milkdown/kit/core'
import { getMarkdown } from '@milkdown/kit/utils'
import { WysiwygEditor } from '../WysiwygEditor'
import { useEditorStore } from '../../../stores/editorStore'

const INITIAL_CONTENT = '# Hello\n\nworld\n'

/** listener.markdownUpdated 有 200ms 防抖，等待 store 同步需要覆盖该窗口 */
const SYNC_TIMEOUT = 1500

describe('WysiwygEditor', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: INITIAL_CONTENT,
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

  function setup() {
    const editorRef = createRef<Editor | null>()
    const utils = render(<WysiwygEditor editorRef={editorRef} />)
    return { editorRef, ...utils }
  }

  async function waitForEditor(editorRef: React.RefObject<Editor | null>) {
    await waitFor(() => expect(editorRef.current).not.toBeNull())
    return editorRef.current!
  }

  function insertTextAt(editor: Editor, text: string, pos: number) {
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.dispatch(view.state.tr.insertText(text, pos))
    })
  }

  it('should mount Milkdown and render store content as rich text', async () => {
    const { container, editorRef } = setup()
    const editor = await waitForEditor(editorRef)

    expect(container.querySelector('.ProseMirror')).toBeInTheDocument()
    expect(container.querySelector('.ProseMirror h1')?.textContent).toBe('Hello')
    expect(container.querySelector('.markdown-body')).toBeInTheDocument()
    // 初始内容序列化应与 store 一致（文档本身就是规范形式）
    expect(editor.action(getMarkdown())).toBe(INITIAL_CONTENT)
  })

  it('should sync editor edits to store', async () => {
    const { editorRef } = setup()
    const editor = await waitForEditor(editorRef)

    // 在标题 "Hello"（pos 1 起为标题文本）末尾输入
    act(() => {
      insertTextAt(editor, '!', 6)
    })

    await waitFor(
      () => {
        expect(useEditorStore.getState().content).toBe('# Hello!\n\nworld\n')
      },
      { timeout: SYNC_TIMEOUT }
    )
    // 回环检查：store 更新后编辑器文档不被重写
    expect(editor.action(getMarkdown())).toBe('# Hello!\n\nworld\n')
  })

  it('should sync external store changes into the editor', async () => {
    const { container, editorRef } = setup()
    const editor = await waitForEditor(editorRef)

    act(() => {
      useEditorStore.getState().setContent('# Replaced\n\nnew paragraph\n')
    })

    await waitFor(() => {
      expect(editor.action(getMarkdown())).toBe('# Replaced\n\nnew paragraph\n')
    })
    expect(container.querySelector('.ProseMirror h1')?.textContent).toBe('Replaced')
  })

  it('should not sync store changes while not in wysiwyg mode', async () => {
    const { editorRef } = setup()
    const editor = await waitForEditor(editorRef)

    act(() => {
      useEditorStore.getState().setViewMode('source')
      useEditorStore.getState().setContent('# Hidden Change\n')
    })

    // 隐藏期间不做整篇重解析；序列化值保持旧内容
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(editor.action(getMarkdown())).toBe(INITIAL_CONTENT)

    // 切回 wysiwyg 时一次性同步
    act(() => {
      useEditorStore.getState().setViewMode('wysiwyg')
    })
    await waitFor(() => {
      expect(editor.action(getMarkdown())).toBe('# Hidden Change\n')
    })
  })

  it('should render task list items with clickable checkbox', async () => {
    useEditorStore.setState({ content: '- [ ] todo one\n- [x] todo two\n' })
    const { container, editorRef } = setup()
    await waitForEditor(editorRef)

    const checkboxes = container.querySelectorAll<HTMLInputElement>('.task-checkbox')
    expect(checkboxes).toHaveLength(2)
    expect(checkboxes[0].checked).toBe(false)
    expect(checkboxes[1].checked).toBe(true)

    // 点击第一个 checkbox → checked attr 翻转 → 防抖后同步到 store
    act(() => {
      checkboxes[0].click()
    })

    await waitFor(
      () => {
        const content = useEditorStore.getState().content
        expect(content).toContain('[x] todo one')
        expect(content).toContain('[x] todo two')
      },
      { timeout: SYNC_TIMEOUT }
    )
  })

  it('should flush pending edits to store when leaving wysiwyg mode', async () => {
    const { editorRef } = setup()
    const editor = await waitForEditor(editorRef)

    act(() => {
      insertTextAt(editor, '!', 6)
    })
    // 立即切换模式（不等 200ms 防抖），离开时应冲刷最后一段输入
    act(() => {
      useEditorStore.getState().setViewMode('source')
    })

    expect(useEditorStore.getState().content).toBe('# Hello!\n\nworld\n')
  })
})
