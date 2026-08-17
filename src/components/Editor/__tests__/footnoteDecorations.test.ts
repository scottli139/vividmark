/**
 * 脚注 WYSIWYG 编号装饰测试（footnoteDecorations.ts）
 *
 * 节点 schema 由 Milkdown gfm 预设自带（footnote_reference 行内 atom /
 * footnote_definition 块节点），本插件只做视图层编号：按引用首现顺序
 * 注入 data-footnote-number（与预览侧 markdown-it-footnote 编号口径一致），
 * CSS 负责把 label 原文替换为 [N] 显示。悬空引用不编号（label 原文显示）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('脚注 WYSIWYG 编号装饰', () => {
  let editor: Editor | null = null

  afterEach(async () => {
    await editor?.destroy()
    editor = null
  })

  async function createEditor(markdown: string): Promise<Editor> {
    const container = document.createElement('div')
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

  function getView(ed: Editor) {
    return ed.action((ctx) => ctx.get(editorViewCtx))
  }

  it('引用按首现顺序编号（与定义书写顺序无关）', async () => {
    const ed = await createEditor('先引[^b]后引[^a]。\n\n[^a]: 定义 A。\n\n[^b]: 定义 B。')
    const refs = getView(ed).dom.querySelectorAll('sup[data-type="footnote_reference"]')

    expect(refs).toHaveLength(2)
    expect(refs[0].getAttribute('data-label')).toBe('b')
    expect(refs[0].getAttribute('data-footnote-number')).toBe('1')
    expect(refs[1].getAttribute('data-label')).toBe('a')
    expect(refs[1].getAttribute('data-footnote-number')).toBe('2')
  })

  it('同一定义的多次引用共享序号', async () => {
    const ed = await createEditor('首次[^1]，再次[^1]，换号[^2]。\n\n[^1]: 共享。\n\n[^2]: 其二。')
    const refs = getView(ed).dom.querySelectorAll('sup[data-footnote-number]')

    expect(refs).toHaveLength(3)
    expect(refs[0].getAttribute('data-footnote-number')).toBe('1')
    expect(refs[1].getAttribute('data-footnote-number')).toBe('1')
    expect(refs[2].getAttribute('data-footnote-number')).toBe('2')
  })

  it('定义块渲染 label（dt 可见可定位），未引用定义不编号也不报错', async () => {
    const ed = await createEditor('正文[^1]。\n\n[^1]: 被引用。\n\n[^unused]: 孤立定义。')
    const defs = getView(ed).dom.querySelectorAll('dl[data-type="footnote_definition"]')

    expect(defs).toHaveLength(2)
    expect(defs[0].querySelector('dt')?.textContent).toBe('1')
    expect(defs[1].querySelector('dt')?.textContent).toBe('unused')
  })

  it('删除定义后引用变为悬空态（编号移除，label 原文保留）', async () => {
    const ed = await createEditor('引用[^1]。\n\n[^1]: 将被删除。')
    const view = getView(ed)

    // 初始：有编号
    expect(view.dom.querySelector('sup[data-footnote-number="1"]')).not.toBeNull()

    // 找到 footnote_definition 节点位置并删除（模拟用户在编辑器里删定义）
    let defPos = -1
    let defSize = 0
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'footnote_definition' && defPos < 0) {
        defPos = pos
        defSize = node.nodeSize
      }
      return true
    })
    expect(defPos).toBeGreaterThan(-1)
    view.dispatch(view.state.tr.delete(defPos, defPos + defSize))

    // 悬空：不再有编号装饰；label 原文仍在（降级为 [^1] 形态显示，由 CSS 补括号）
    const ref = view.dom.querySelector('sup[data-type="footnote_reference"]')
    expect(ref).not.toBeNull()
    expect(ref!.getAttribute('data-footnote-number')).toBeNull()
    expect(ref!.getAttribute('data-label')).toBe('1')
  })

  it('编号随编辑实时更新（删掉首个引用后后续引用重排）', async () => {
    const ed = await createEditor('甲[^a]乙[^b]。\n\n[^a]: 定义 A。\n\n[^b]: 定义 B。')
    const view = getView(ed)

    // 删掉 [^a] 引用节点本身（atom 节点整体删除）
    let refPos = -1
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'footnote_reference' && node.attrs.label === 'a' && refPos < 0) {
        refPos = pos
      }
      return true
    })
    expect(refPos).toBeGreaterThan(-1)
    view.dispatch(view.state.tr.delete(refPos, refPos + view.state.doc.nodeAt(refPos)!.nodeSize))

    // [^b] 重排为 1
    const remaining = view.dom.querySelector('sup[data-type="footnote_reference"]')
    expect(remaining?.getAttribute('data-label')).toBe('b')
    expect(remaining?.getAttribute('data-footnote-number')).toBe('1')
  })
})
