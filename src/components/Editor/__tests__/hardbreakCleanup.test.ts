/**
 * 幻影 hardbreak 清理测试
 *
 * 背景：WKWebView + 中文 IME 组合输入时，浏览器的 <br> 占位可能被 PM 回读成
 * hardbreak 节点（isInline:false），序列化成 `\` 垃圾行。
 * 清理只在带 composition meta 的事务后触发（PM 的 readDOMChange 会给 IME
 * 组合期间的回读事务打标）；普通编辑/粘贴/加载不触发，避免误伤合法硬换行。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { TextSelection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('hardbreak cleanup', () => {
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

  /** 模拟 IME 幻影：注入 hardbreak 节点（composition meta 模拟 PM 的回读事务） */
  function insertPhantomHardbreak(view: EditorView, count = 1) {
    const hardbreak = view.state.schema.nodes.hardbreak
    for (let i = 0; i < count; i++) {
      view.dispatch(
        view.state.tr.replaceSelectionWith(hardbreak.create()).setMeta('composition', 1)
      )
    }
  }

  function countHardbreaks(view: EditorView): number {
    let count = 0
    view.state.doc.descendants((node) => {
      if (node.type.name === 'hardbreak') count++
      return true
    })
    return count
  }

  it('removes a phantom hardbreak-only paragraph (replaced with empty paragraph when only child)', async () => {
    const ed = await createEditor('')
    const view = getView(ed)

    insertPhantomHardbreak(view)

    expect(countHardbreaks(view)).toBe(0)
    // doc 仍保留一个合法的空段落
    expect(view.state.doc.childCount).toBe(1)
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph')
    // 序列化不含 `\` 垃圾行
    expect(ed.action(getMarkdown())).not.toContain('\\')
  })

  it('deletes phantom hardbreak paragraphs inside an admonition', async () => {
    const ed = await createEditor('::: note\n内容\n:::')
    const view = getView(ed)

    // 光标移到「内容」末尾，分裂出一个新段落，再注入幻影 hardbreak
    let contentEnd = -1
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === '内容') contentEnd = pos + node.text!.length
      return true
    })
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, contentEnd)))
    const { splitBlock } = await import('@milkdown/kit/prose/commands')
    splitBlock(view.state, view.dispatch)
    insertPhantomHardbreak(view)

    expect(countHardbreaks(view)).toBe(0)
    // admonition 结构完好，且非唯一子节点的幻影段落被直接删除
    let admonitionChildren = 0
    view.state.doc.descendants((node) => {
      if (node.type.name === 'admonition') {
        admonitionChildren = node.childCount
        return false
      }
      return true
    })
    expect(admonitionChildren).toBe(1)
    expect(ed.action(getMarkdown())).not.toContain('\\')
  })

  it('keeps legitimate Shift+Enter hard breaks attached to text', async () => {
    // markdown 里的 `\` 硬换行：text + hardbreak + text
    const ed = await createEditor('第一行\\\n第二行')
    const view = getView(ed)
    expect(countHardbreaks(view)).toBe(1)

    // 在文档末尾做一次无关编辑，合法硬换行应存活
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.doc.content.size - 1)
      )
    )
    view.dispatch(view.state.tr.insertText('第三行'))

    expect(countHardbreaks(view)).toBe(1)
    expect(ed.action(getMarkdown())).toContain('第一行\\\n第二行')
  })

  it('collapses runs of 2+ phantom hardbreaks mixed into a text paragraph', async () => {
    const ed = await createEditor('哈哈哈哈')
    const view = getView(ed)

    // 模拟 IME 幻影：文本尾部一次性混入 3 个连续 hardbreak
    const hb = view.state.schema.nodes.hardbreak
    const endPos = view.state.doc.content.size - 1
    view.dispatch(
      view.state.tr
        .insert(endPos, [hb.create(), hb.create(), hb.create()])
        .setMeta('composition', 1)
    )

    // 运行段整段清除，文本原样保留
    expect(countHardbreaks(view)).toBe(0)
    const markdown = ed.action(getMarkdown())
    expect(markdown).not.toContain('\\')
    expect(markdown).toContain('哈哈哈哈')
  })

  it('keeps a single trailing hard break (legit Shift+Enter transient state)', async () => {
    const ed = await createEditor('哈哈哈哈')
    const view = getView(ed)

    const hb = view.state.schema.nodes.hardbreak
    const endPos = view.state.doc.content.size - 1
    view.dispatch(view.state.tr.insert(endPos, hb.create()).setMeta('composition', 1))

    // 单个 hardbreak 是合法硬换行（用户可能正要继续输入下一行），必须保留
    expect(countHardbreaks(view)).toBe(1)
    // 段落末尾的硬换行对渲染无意义，序列化时被省略——不应留下任何 `\` 垃圾
    expect(ed.action(getMarkdown())).toBe('哈哈哈哈\n')
  })

  it('does NOT clean hardbreaks from non-composition transactions', async () => {
    // 源码加载/普通编辑产生的（哪怕罕见的）连续硬换行是用户内容，不动
    const ed = await createEditor('第一行\\\n\\\n第二行')
    const view = getView(ed)
    const before = countHardbreaks(view)
    expect(before).toBeGreaterThan(0)

    // 普通事务（无 composition meta）触发 appendTransaction，但清理应跳过
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.doc.content.size - 1)
      )
    )
    view.dispatch(view.state.tr.insertText('尾'))

    expect(countHardbreaks(view)).toBe(before)
  })

  it('removes 3+ ASCII space runs (IME marked-text residue) on composition transactions', async () => {
    const ed = await createEditor('你会')
    const view = getView(ed)

    // 模拟上屏残留：文本尾部混入 5 个连续空格（composition meta）
    const endPos = view.state.doc.content.size - 1
    view.dispatch(view.state.tr.insertText('     ', endPos).setMeta('composition', 1))

    expect(view.state.doc.textContent).toBe('你会')
  })

  it('keeps double spaces (legit hard-break authoring)', async () => {
    const ed = await createEditor('你会')
    const view = getView(ed)

    const endPos = view.state.doc.content.size - 1
    view.dispatch(view.state.tr.insertText('  ', endPos).setMeta('composition', 1))

    expect(view.state.doc.textContent).toBe('你会  ')
  })

  it('does not touch space runs in code blocks', async () => {
    const ed = await createEditor('```js\nconst a  =  1\n```')
    const view = getView(ed)

    // 在代码块尾部经 composition 事务塞入 4 个空格——代码块内容不受影响
    let codeEnd = -1
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'code_block') codeEnd = pos + node.nodeSize - 1
      return true
    })
    view.dispatch(view.state.tr.insertText('    ', codeEnd).setMeta('composition', 1))

    expect(view.state.doc.textContent).toContain('    ')
  })

  it('defers cleanup while composing, runs it after compositionend', async () => {
    const ed = await createEditor('第一行')
    const view = getView(ed)

    // 模拟上屏事务在 composing=true 时到达（PM 的实际时序）：不立即清理
    ;(view as unknown as { input: { composing: boolean } }).input.composing = true
    const hb = view.state.schema.nodes.hardbreak
    const endPos = view.state.doc.content.size - 1
    view.dispatch(
      view.state.tr.insert(endPos, [hb.create(), hb.create()]).setMeta('composition', 1)
    )
    expect(countHardbreaks(view)).toBe(2) // 组合进行中，不打扰

    // 组合结束 → 延迟清理
    ;(view as unknown as { input: { composing: boolean } }).input.composing = false
    view.dom.dispatchEvent(new CompositionEvent('compositionend'))
    await new Promise((r) => setTimeout(r, 80))

    expect(countHardbreaks(view)).toBe(0)
    expect(view.state.doc.textContent).toBe('第一行')
  })
})
