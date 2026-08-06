/**
 * WYSIWYG 内新建 admonition 测试
 * - editor-insert 片段（`::: type 标题` 围栏）解析为 admonition 节点而非纯文本
 * - 插入后光标落入容器内部，可直接继续输入
 * - 序列化回围栏语法无损
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { getMarkdown } from '@milkdown/kit/utils'
import { insertWysiwygSnippet } from '../wysiwygFormat'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('wysiwyg admonition insert', () => {
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

  function findAdmonition(doc: ProseNode): ProseNode | null {
    let found: ProseNode | null = null
    doc.descendants((node) => {
      if (node.type.name === 'admonition') {
        found = node
        return false
      }
      return true
    })
    return found
  }

  it('inserts an admonition node from a fence snippet', async () => {
    const ed = await createEditor('')
    ed.action((ctx) => insertWysiwygSnippet(ctx, '::: tip\n\n:::'))

    const view = ed.action((ctx) => ctx.get(editorViewCtx))
    const admonition = findAdmonition(view.state.doc)
    expect(admonition).not.toBeNull()
    expect(admonition!.attrs.admonitionType).toBe('tip')
    expect(ed.action(getMarkdown())).toContain('::: tip')
  })

  it('keeps the custom title in attrs and serialization', async () => {
    const ed = await createEditor('')
    ed.action((ctx) => insertWysiwygSnippet(ctx, '::: warning 注意\n\n:::'))

    const view = ed.action((ctx) => ctx.get(editorViewCtx))
    const admonition = findAdmonition(view.state.doc)
    expect(admonition).not.toBeNull()
    expect(admonition!.attrs.admonitionType).toBe('warning')
    expect(admonition!.attrs.title).toBe('注意')
    expect(ed.action(getMarkdown())).toContain('::: warning 注意')
  })

  it('places the cursor inside the admonition after insertion', async () => {
    const ed = await createEditor('')
    ed.action((ctx) => insertWysiwygSnippet(ctx, '::: tip\n\n:::'))

    const view = ed.action((ctx) => ctx.get(editorViewCtx))
    const { $from } = view.state.selection
    let inside = false
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'admonition') inside = true
    }
    expect(inside).toBe(true)
  })

  it('renders the admonition nodeview with title and editable content', async () => {
    const ed = await createEditor('')
    ed.action((ctx) => insertWysiwygSnippet(ctx, '::: danger\n\n:::'))

    const dom = container!.querySelector('.admonition.danger')
    expect(dom).toBeInTheDocument()
    expect(dom!.querySelector('.admonition-title')?.textContent).toBe('Danger')
    expect(dom!.querySelector('.admonition-content')).toBeInTheDocument()
  })
})
