/**
 * WYSIWYG Enter 行为测试（用户约定的「单换行」模型）
 *
 * - 普通段落按 Enter = 行内软换行（isInline hardbreak；源码为单个换行符，行间无空行）
 * - 段尾已是软换行时再按 Enter = 折叠为新段落（Enter×2 = 新段落，段落语义入口）
 * - 列表项 / 标题 / 代码块的 Enter 行为不变
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { TextSelection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('wysiwyg Enter behavior (soft break model)', () => {
  let editor: Editor | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    await editor?.destroy()
    editor = null
    container?.remove()
    container = null
  })

  async function createEditor(markdown: string): Promise<Editor> {
    container = document.createElement('div')
    document.body.appendChild(container)
    editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, markdown)
      })
      .use(wysiwygPlugins)
      .create()
    return editor
  }

  function getView(ed: Editor): EditorView {
    return ed.action((ctx) => ctx.get(editorViewCtx))
  }

  function pressEnter(view: EditorView) {
    view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
  }

  function cursorToEnd(view: EditorView) {
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.doc.content.size - 1)
      )
    )
  }

  it('Enter in a paragraph inserts a soft break (single newline in source)', async () => {
    const ed = await createEditor('第一行')
    const view = getView(ed)
    cursorToEnd(view)

    pressEnter(view)

    // 不分段：仍是一个段落，内含 isInline 软换行
    expect(view.state.doc.childCount).toBe(1)
    const para = view.state.doc.firstChild!
    expect(para.type.name).toBe('paragraph')
    expect(para.lastChild?.type.name).toBe('hardbreak')
    expect(para.lastChild?.attrs.isInline).toBe(true)

    // 再输入一行文字后，源码是单换行分隔（无空行）
    view.dispatch(view.state.tr.insertText('第二行'))
    const md = ed.action(getMarkdown())
    expect(md).toBe('第一行\n第二行\n')
  })

  it('Enter twice folds into a new paragraph (blank line in source)', async () => {
    const ed = await createEditor('第一行')
    const view = getView(ed)
    cursorToEnd(view)

    pressEnter(view)
    pressEnter(view)

    expect(view.state.doc.childCount).toBe(2)
    expect(view.state.doc.lastChild?.type.name).toBe('paragraph')
    const md = ed.action(getMarkdown())
    expect(md).toBe('第一行\n\n')
  })

  it('Enter in a list item creates a new list item', async () => {
    const ed = await createEditor('- 条目一')
    const view = getView(ed)
    // 光标定位到列表项文本末尾（须在文本节点之后，确保落在段落内部）
    let textEnd = -1
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === '条目一') textEnd = pos + node.text!.length
      return true
    })
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, textEnd)))

    pressEnter(view)

    const list = view.state.doc.firstChild!
    expect(list.type.name).toBe('bullet_list')
    expect(list.childCount).toBe(2)
  })

  it('Enter in a heading creates a following paragraph', async () => {
    const ed = await createEditor('# 标题')
    const view = getView(ed)
    cursorToEnd(view)

    pressEnter(view)

    expect(view.state.doc.childCount).toBe(2)
    expect(view.state.doc.firstChild?.type.name).toBe('heading')
    expect(view.state.doc.lastChild?.type.name).toBe('paragraph')
  })

  it('Enter in a code block inserts a plain newline', async () => {
    const ed = await createEditor('```js\nconst a = 1\n```')
    const view = getView(ed)
    // 光标移到代码块内容末尾
    let codeEnd = -1
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'code_block') codeEnd = pos + node.nodeSize - 1
      return true
    })
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, codeEnd)))

    pressEnter(view)

    expect(view.state.doc.childCount).toBe(1)
    expect(view.state.doc.firstChild?.textContent).toContain('const a = 1\n')
  })

  it('round-trips soft-break lines losslessly', async () => {
    const ed = await createEditor('第一行\n第二行\n第三行')
    const md = ed.action(getMarkdown())
    expect(md).toBe('第一行\n第二行\n第三行\n')
  })

  it('renders soft breaks as real line breaks (br, not span)', async () => {
    const ed = await createEditor('第一行\n第二行')
    void ed
    // isInline 软换行经 nodeview 渲染为 <br>（Milkdown 默认是带空格的 span，不换行）
    const br = container!.querySelector('br[data-type="hardbreak"][data-is-inline="true"]')
    expect(br).toBeInTheDocument()
    expect(container!.querySelector('span[data-type="hardbreak"]')).not.toBeInTheDocument()
  })
})
