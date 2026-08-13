/**
 * WYSIWYG 数学公式（KaTeX）测试
 *
 * 验证 remark-math + 自写 schema/nodeview 的解析、渲染与往返序列化：
 * - `$...$` → math_inline 节点，序列化回 `$...$`
 * - `$$` 多行围栏 → math_block 节点，序列化回围栏
 * - 单行 `$$x$$` 按 micromark 规则解析为行内公式，首次序列化规整为 `$x$`
 * - 二次往返不动点；与既有扩展语法混排不互相干扰
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { getMarkdown } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('wysiwyg math (KaTeX)', () => {
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
    return ed.ctx.get(editorViewCtx)
  }

  it('should parse $...$ into math_inline node and serialize back', async () => {
    const ed = await createEditor('质能方程 $e=mc^2$ 著名')
    const doc = getView(ed).state.doc.toJSON()
    expect(JSON.stringify(doc)).toContain('math_inline')

    const out = ed.action(getMarkdown())
    expect(out).toContain('$e=mc^2$')
  })

  it('should parse $$ fence into math_block node and serialize back', async () => {
    const ed = await createEditor('$$\n\\frac{1}{2}\n$$')
    const doc = getView(ed).state.doc.toJSON()
    expect(JSON.stringify(doc)).toContain('math_block')

    const out = ed.action(getMarkdown())
    expect(out).toMatch(/\$\$\s*\\frac\{1\}\{2\}\s*\$\$/)
  })

  it('should parse single-line $$x$$ as inline math (micromark compat)', async () => {
    const ed = await createEditor('$$x+y$$')
    const doc = getView(ed).state.doc.toJSON()
    expect(JSON.stringify(doc)).toContain('math_inline')
    expect(JSON.stringify(doc)).not.toContain('math_block')

    // 首次序列化规整为 $...$，二次往返不动点
    const out1 = ed.action(getMarkdown())
    expect(out1).toContain('$x+y$')
    expect(out1).not.toContain('$$x+y$$')

    const ed2 = await createEditor(out1)
    expect(ed2.action(getMarkdown())).toBe(out1)
  })

  it('should keep math value stable through double round-trip', async () => {
    const source = '公式 $e=mc^2$ 与\n\n$$\n\\int_a^b f(x) dx\n$$\n'
    const ed = await createEditor(source)
    const out1 = ed.action(getMarkdown())

    const ed2 = await createEditor(out1)
    const out2 = ed2.action(getMarkdown())
    expect(out2).toBe(out1)
  })

  it('should round-trip math mixed with other extensions', async () => {
    const source = [
      '# 标题',
      '',
      '::: tip',
      '公式 $a^2+b^2=c^2$',
      ':::',
      '',
      '- [ ] 任务 $x_1$',
      '',
      '$$\nE = mc^2\n$$',
      '',
    ].join('\n')
    const ed = await createEditor(source)
    const out = ed.action(getMarkdown())

    expect(out).toContain('::: tip')
    expect(out).toContain('$a^2+b^2=c^2$')
    expect(out).toContain('$x_1$')
    expect(out).toMatch(/\$\$\s*E = mc\^2\s*\$\$/)

    const ed2 = await createEditor(out)
    expect(ed2.action(getMarkdown())).toBe(out)
  })

  it('should render katex output in nodeview', async () => {
    await createEditor('$e=mc^2$')
    // nodeview 渲染态：.math-inline 内挂 katex 输出
    expect(container!.querySelector('.math-inline .katex')).not.toBeNull()
  })

  it('should render block math with katex-display in nodeview', async () => {
    await createEditor('$$\n\\frac{1}{2}\n$$')
    expect(container!.querySelector('.math-block .katex-display')).not.toBeNull()
  })

  it('should round-trip block math inside admonition', async () => {
    const source = '::: tip 公式\n$$\n\\frac{1}{2}\n$$\n:::'
    const ed = await createEditor(source)
    const out = ed.action(getMarkdown())

    expect(out).toContain('::: tip 公式')
    expect(out).toMatch(/\$\$\s*\\frac\{1\}\{2\}\s*\$\$/)

    const ed2 = await createEditor(out)
    expect(ed2.action(getMarkdown())).toBe(out)
  })

  it('should round-trip inline math inside table cell', async () => {
    const source = '| 名称 | 公式 |\n| --- | --- |\n| 圆面积 | $S = \\pi r^2$ |'
    const ed = await createEditor(source)
    const out = ed.action(getMarkdown())

    expect(out).toContain('$S = \\pi r^2$')

    const ed2 = await createEditor(out)
    expect(ed2.action(getMarkdown())).toBe(out)
  })
})
