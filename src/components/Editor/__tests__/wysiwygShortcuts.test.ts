/**
 * WYSIWYG 格式快捷键测试（Mod-K 链接、Mod-1/2/3 标题）
 * 与 source 模式 tooltip 宣称的按键一致；复用工具栏同一套 format 实现。
 * jsdom 下通过向 view.dom 派发 KeyboardEvent 走 PM 真实 keymap 路径
 * （setup.ts 把 navigator.platform mock 为 MacIntel，Mod = metaKey）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('wysiwyg format shortcuts', () => {
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

  function pressMod(view: EditorView, key: string) {
    view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key, metaKey: true, bubbles: true, cancelable: true })
    )
  }

  it('Mod-k wraps the selection in a link mark', async () => {
    const ed = await createEditor('hello world')
    const view = getView(ed)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 12)))

    pressMod(view, 'k')

    let linked: string | null = null
    view.state.doc.descendants((node) => {
      if (node.isText && node.marks.some((m) => m.type.name === 'link')) {
        linked = node.text
      }
    })
    expect(linked).toBe('hello world')
  })

  it('Mod-k inserts a selected placeholder link when selection is empty', async () => {
    const ed = await createEditor('hello')
    const view = getView(ed)
    // 折叠选区到段落内
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)))

    pressMod(view, 'k')

    expect(view.state.doc.textContent).toContain('link text')
    // 占位文本处于选中态，方便直接输入替换
    expect(view.state.selection.empty).toBe(false)
  })

  it('Mod-1/2/3 toggle heading levels', async () => {
    const ed = await createEditor('title')
    const view = getView(ed)

    pressMod(view, '1')
    expect(view.state.doc.firstChild?.type.name).toBe('heading')
    expect(view.state.doc.firstChild?.attrs.level).toBe(1)

    // 再按一次同级快捷键回到段落（toggle）
    pressMod(view, '1')
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph')

    pressMod(view, '3')
    expect(view.state.doc.firstChild?.type.name).toBe('heading')
    expect(view.state.doc.firstChild?.attrs.level).toBe(3)

    pressMod(view, '2')
    expect(view.state.doc.firstChild?.type.name).toBe('heading')
    expect(view.state.doc.firstChild?.attrs.level).toBe(2)
  })
})
