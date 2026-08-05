/**
 * Admonition（::: 容器）测试：mdast 变换、markdown 往返无损、nodeview 渲染
 *
 * 往返无损是硬指标：类型、自定义标题、内部块结构（列表/代码块）、
 * 未闭合降级、嵌套 admonition、blockquote 内 admonition。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('admonition (::: container)', () => {
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

  function roundTrip(ed: Editor, markdown: string): string {
    ed.action(replaceAll(markdown, true))
    return ed.action(getMarkdown())
  }

  it('parses into an admonition node and renders styled container', async () => {
    const ed = await createEditor('::: tip\n这是 **提示**\n:::')
    const out = ed.action(getMarkdown())
    expect(out).toContain('::: tip')
    expect(out).toContain(':::')

    // nodeview 渲染：容器 + 类型 class + 默认标题 + 内容区
    const el = container!.querySelector('.admonition.tip')
    expect(el).toBeInTheDocument()
    expect(el!.querySelector('.admonition-title')?.textContent).toBe('Tip')
    expect(el!.querySelector('.admonition-content')).toBeInTheDocument()
    // 内容区仍可编辑（contentDOM 参与 PM 文档）
    expect(el!.querySelector('.admonition-content p')?.textContent).toContain('这是')
  })

  it('round-trips basic admonition losslessly', async () => {
    const ed = await createEditor('')
    const src = '::: tip\n这是提示内容\n:::'
    const out = roundTrip(ed, src)
    expect(out).toBe(`${src}\n`)
  })

  it('round-trips custom title', async () => {
    const ed = await createEditor('')
    const src = '::: warning 自定义标题\n警告内容\n:::'
    const out = roundTrip(ed, src)
    expect(out).toBe(`${src}\n`)
  })

  it('shows custom title in nodeview, falls back to capitalized type', async () => {
    await createEditor('::: danger 小心！\n内容\n:::')
    expect(container!.querySelector('.admonition.danger .admonition-title')?.textContent).toBe(
      '小心！'
    )
  })

  it('round-trips nested blocks (list + code block) inside container', async () => {
    const ed = await createEditor('')
    const src = [
      '::: note',
      '- 条目一',
      '- 条目二',
      '',
      '```js',
      "console.log('x')",
      '```',
      ':::',
    ].join('\n')
    const out = roundTrip(ed, src)
    expect(out).toContain('::: note')
    // 列表符号允许被规范化为 * 或 -
    expect(out).toMatch(/[*-] 条目一/)
    expect(out).toContain('```js')
    expect(out).toContain("console.log('x')")
    expect(out).toContain(':::')
    // 二次往返稳定
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('keeps unclosed markers as plain paragraphs (degraded, no crash)', async () => {
    const ed = await createEditor('')
    const src = '::: tip\n没有闭合的内容\n\n后续段落'
    const out = roundTrip(ed, src)
    expect(out).toContain('::: tip')
    expect(out).toContain('没有闭合的内容')
    expect(out).toContain('后续段落')
    // 不产生 admonition 节点
    expect(container!.querySelector('.admonition')).not.toBeInTheDocument()
  })

  it('round-trips nested admonitions', async () => {
    const ed = await createEditor('')
    const src = ['::: warning 外层', '外层内容', '', '::: tip 内层', '内层内容', ':::', ':::'].join(
      '\n'
    )
    const out = roundTrip(ed, src)
    expect(out).toContain('::: warning 外层')
    expect(out).toContain('::: tip 内层')
    expect(out).toContain('外层内容')
    expect(out).toContain('内层内容')
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('round-trips admonition inside blockquote', async () => {
    const ed = await createEditor('')
    const src = '> ::: tip\n> 引用内的提示\n> :::'
    const out = roundTrip(ed, src)
    expect(out).toContain('::: tip')
    expect(out).toContain('引用内的提示')
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('supports all nine admonition types', async () => {
    const ed = await createEditor('')
    const types = [
      'tip',
      'warning',
      'info',
      'note',
      'danger',
      'success',
      'hint',
      'important',
      'caution',
    ]
    for (const type of types) {
      const src = `::: ${type}\n内容\n:::`
      expect(roundTrip(ed, src)).toBe(`${src}\n`)
    }
  })

  it('does not treat unknown ::: name as admonition', async () => {
    const ed = await createEditor('')
    const src = '::: unknown\n内容\n:::'
    const out = roundTrip(ed, src)
    expect(out).toContain('::: unknown')
    expect(container!.querySelector('.admonition')).not.toBeInTheDocument()
  })

  it('supports editing inside the container (contentDOM is live)', async () => {
    const ed = await createEditor('::: tip\n原始内容\n:::')

    // 在容器内段落末尾输入文字
    ed.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      // 文档结构：doc > admonition > paragraph，文本从 pos 2 开始
      view.dispatch(view.state.tr.insertText('（追加）', 6))
    })

    const out = ed.action(getMarkdown())
    expect(out).toContain('原始内容（追加）')
    expect(out).toContain('::: tip')
  })

  it('reaches a fixed point on a mixed document', async () => {
    const mixed = [
      '# 标题',
      '',
      '::: tip 提示',
      '- a',
      '- b',
      '',
      '```plantuml',
      '@startuml',
      'A -> B',
      '@enduml',
      '```',
      ':::',
      '',
      '正文 ![图](./a.png)',
    ].join('\n')
    const ed = await createEditor(mixed)
    const first = ed.action(getMarkdown())
    ed.action(replaceAll(first, true))
    expect(ed.action(getMarkdown())).toBe(first)
  })
})
