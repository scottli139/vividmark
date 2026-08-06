/**
 * 严格 <br> 解析测试（v2，ignore 语义）
 *
 * PM 自己渲染的 hardbreak 带 data-type="hardbreak" 属性，予以保留；
 * 浏览器在 IME 组合输入时插入的裸 <br> 占位节点被整块忽略（不产生任何
 * 节点或文本）——幻影无法进入文档，也不会像 v1（转文本）那样污染 diff。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('strict br parser (ignore bare br)', () => {
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

  function countHardbreaks(doc: ProseNode): number {
    let count = 0
    doc.descendants((node) => {
      if (node.type.name === 'hardbreak') count++
      return true
    })
    return count
  }

  it('exposes a custom domParser view prop', async () => {
    const ed = await createEditor('')
    expect(getView(ed).someProp('domParser')).toBeDefined()
  })

  it('ignores bare <br> placeholders entirely (no node, no text)', async () => {
    const ed = await createEditor('')
    const parser = getView(ed).someProp('domParser')!

    const dom = document.createElement('div')
    dom.innerHTML = '<p>哈哈<br>哈哈</p>'
    const doc = parser.parse(dom)

    expect(countHardbreaks(doc)).toBe(0)
    // 不产生任何残留：无 hardbreak、无换行文本、无空格
    expect(doc.textContent).toBe('哈哈哈哈')
  })

  it('ignores the trailing-break hack node in empty blocks', async () => {
    const ed = await createEditor('')
    const parser = getView(ed).someProp('domParser')!

    const dom = document.createElement('div')
    dom.innerHTML = '<p>你会</p><p><br class="ProseMirror-trailingBreak"></p>'
    const doc = parser.parse(dom)

    expect(countHardbreaks(doc)).toBe(0)
    expect(doc.textContent).toBe('你会')
  })

  it('keeps PM-rendered hardbreaks (data-type="hardbreak")', async () => {
    const ed = await createEditor('')
    const parser = getView(ed).someProp('domParser')!

    const dom = document.createElement('div')
    dom.innerHTML = '<p>a<br data-type="hardbreak" data-is-inline="false">b</p>'
    const doc = parser.parse(dom)

    expect(countHardbreaks(doc)).toBe(1)
    expect(doc.textContent).toContain('a')
    expect(doc.textContent).toContain('b')
  })

  it('preserves isInline when reading rendered soft breaks back', async () => {
    const ed = await createEditor('')
    const parser = getView(ed).someProp('domParser')!

    const dom = document.createElement('div')
    dom.innerHTML = '<p>a<br data-type="hardbreak" data-is-inline="true">b</p>'
    const doc = parser.parse(dom)

    let isInline: boolean | null = null
    doc.descendants((node) => {
      if (node.type.name === 'hardbreak') isInline = node.attrs.isInline as boolean
      return true
    })
    expect(isInline).toBe(true)
  })

  it('round-trips hard breaks through render → parse', async () => {
    // 源码硬换行 → PM hardbreak → 渲染 DOM → domParser 回读 → 仍是 hardbreak
    const ed = await createEditor('第一行\\\n第二行')
    const view = getView(ed)
    const parser = view.someProp('domParser')!

    const rendered = view.dom.querySelector('p')!
    const host = document.createElement('div')
    host.appendChild(rendered.cloneNode(true))
    const doc = parser.parse(host)

    expect(countHardbreaks(doc)).toBe(1)
  })
})
