/**
 * Admonition（::: 容器）测试：mdast 变换、markdown 往返无损、nodeview 渲染
 *
 * 往返无损是硬指标：类型、自定义标题、内部块结构（列表/代码块）、
 * 未闭合降级、嵌套 admonition、blockquote 内 admonition。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { TextSelection } from '@milkdown/kit/prose/state'
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
    // 规范形态：结束围栏前有一个空行（防止末块与围栏融合，见实现注释）
    const src = '::: tip\n这是提示内容\n\n:::'
    const out = roundTrip(ed, src)
    expect(out).toBe(`${src}\n`)
  })

  it('normalizes a missing blank line before the closing fence', async () => {
    const ed = await createEditor('')
    // 旧写法（围栏前无空行）解析正常，序列化规范化为带空行形态
    const out = roundTrip(ed, '::: tip\n这是提示内容\n:::')
    expect(out).toBe('::: tip\n这是提示内容\n\n:::\n')
  })

  it('round-trips custom title', async () => {
    const ed = await createEditor('')
    const src = '::: warning 自定义标题\n警告内容\n\n:::'
    const out = roundTrip(ed, src)
    expect(out).toBe(`${src}\n`)
  })

  it('preserves hard breaks when fence lines are fused with content', async () => {
    const ed = await createEditor('')
    // 围栏与内容之间无空行：remarkLineBreaks 把它们融合成一个含 break 的段落，
    // explodeParagraph 拆开重拼时必须保留原始硬换行（`\`），不能降级成软换行
    const src = '::: tip\n哈哈哈哈\\\n密密麻麻吗\n:::'
    const out = roundTrip(ed, src)
    expect(out).toContain('::: tip')
    expect(out).toContain('哈哈哈哈\\')
    expect(out).toContain('密密麻麻吗')
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

  it('drops trailing empty paragraphs and never fuses the closing fence into an html block', async () => {
    const ed = await createEditor('::: danger\n你会\n\n:::')
    const view = ed.action((ctx) => ctx.get(editorViewCtx))

    // 在「你会」末尾回车，制造尾部空段落（序列化的 `<br />` 曾紧贴 ::: 被 html 块吞掉围栏）
    let contentEnd = -1
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === '你会') contentEnd = pos + node.text!.length
      return true
    })
    const { splitBlock } = await import('@milkdown/kit/prose/commands')
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, contentEnd)))
    splitBlock(view.state, view.dispatch)

    const out = ed.action(getMarkdown())
    expect(out).not.toContain('<br')
    expect(out).toContain('\n\n:::')

    // 重新解析后围栏存活：仍是 admonition 节点而非降级文本
    ed.action(replaceAll(out, true))
    let hasAdmonition = false
    view.state.doc.descendants((node) => {
      if (node.type.name === 'admonition') hasAdmonition = true
      return true
    })
    expect(hasAdmonition).toBe(true)
  })

  it('serializes an empty admonition to a clean fixed point (no <br />)', async () => {
    const ed = await createEditor('')
    const out = roundTrip(ed, '::: note\n\n:::')
    expect(out).toBe('::: note\n:::\n')
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('keeps the closing fence when the last block is a blockquote', async () => {
    const ed = await createEditor('')
    // `> 引用` 后直接跟 `:::` 会被 blockquote 懒惰延续吞掉；序列化必须补空行
    const out = roundTrip(ed, '::: tip\n> 引用\n\n:::')
    expect(out).toContain('\n\n:::')
    const second = roundTrip(ed, out)
    expect(second).toBe(out)
    expect(second).toContain('::: tip')
    expect(second).toContain('> 引用')
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
      const src = `::: ${type}\n内容\n\n:::`
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
