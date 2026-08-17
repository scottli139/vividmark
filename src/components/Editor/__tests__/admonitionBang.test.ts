/**
 * MkDocs `!!!` admonition WYSIWYG 往返测试
 *
 * 硬性约束：「!!! 进、!!! 出」（语法保持往返）——若归一成 `:::` 写回，
 * Python-Markdown 只认 `!!!`，等于弄坏用户的 mkdocs 构建。
 * 解析挂点与生产一致：defaultValueCtx / replaceAll 前过 preprocessBangAdmonitions
 * （见 WysiwygEditor.tsx）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { preprocessBangAdmonitions } from '../../../lib/markdown/bangAdmonition'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('!!! admonition（mkdocs 风格）WYSIWYG 往返', () => {
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
        ctx.set(defaultValueCtx, preprocessBangAdmonitions(markdown))
      })
      .use(wysiwygPlugins)
      .create()
    return editor
  }

  function roundTrip(ed: Editor, markdown: string): string {
    ed.action(replaceAll(preprocessBangAdmonitions(markdown), true))
    return ed.action(getMarkdown())
  }

  function firstAdmonitionAttrs(ed: Editor): Record<string, unknown> | null {
    let attrs: Record<string, unknown> | null = null
    ed.action((ctx) => {
      ctx.get(editorViewCtx).state.doc.descendants((node) => {
        if (attrs === null && node.type.name === 'admonition') attrs = node.attrs
        return true
      })
    })
    return attrs
  }

  it('!!! 进、!!! 出（语法保持，不归一为 :::）', async () => {
    const ed = await createEditor('!!! note\n    这是提示内容')
    const out = ed.action(getMarkdown())
    expect(out).toBe('!!! note\n    这是提示内容\n')
    expect(out).not.toContain(':::')
  })

  it('PM 节点带 syntax: bang attr；nodeview 渲染相同样式结构', async () => {
    const ed = await createEditor('!!! warning "小心"\n    内容')
    expect(firstAdmonitionAttrs(ed)).toMatchObject({
      admonitionType: 'warning',
      title: '小心',
      syntax: 'bang',
    })
    const el = container!.querySelector('.admonition.warning')
    expect(el).toBeInTheDocument()
    expect(el!.querySelector('.admonition-title')?.textContent).toBe('小心')
  })

  it('无引号标题规范化为引号形式，二次往返稳定', async () => {
    const ed = await createEditor('')
    const out = roundTrip(ed, '!!! tip 无引号标题\n    内容')
    expect(out).toBe('!!! tip "无引号标题"\n    内容\n')
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('未知类型（mkdocs 扩展类型）原样保留往返，nodeview 降级 note 主题', async () => {
    const ed = await createEditor('!!! abstract\n    摘要')
    expect(firstAdmonitionAttrs(ed)?.admonitionType).toBe('abstract')
    // class 降级 note 主题，但 data attr 保留原类型
    expect(container!.querySelector('.admonition.note')).toBeInTheDocument()
    expect(container!.querySelector('.admonition')?.getAttribute('data-admonition-type')).toBe(
      'abstract'
    )
    expect(ed.action(getMarkdown())).toBe('!!! abstract\n    摘要\n')
  })

  it('多段内容（空行悬挂）往返', async () => {
    const ed = await createEditor('')
    const out = roundTrip(ed, '!!! note\n    第一段\n\n    第二段')
    expect(out).toBe('!!! note\n    第一段\n\n    第二段\n')
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('嵌套 bang 往返（内外层都保持 !!!）', async () => {
    const ed = await createEditor('')
    const src = '!!! note\n    外层\n\n    !!! tip "内层"\n        内层内容'
    const out = roundTrip(ed, src)
    expect(out).toBe(`${src}\n`)
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('容器内围栏代码块往返', async () => {
    const ed = await createEditor('')
    const src = '!!! note\n    说明\n\n    ```js\n    const a = 1\n    ```'
    const out = roundTrip(ed, src)
    expect(out).toBe(`${src}\n`)
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('空容器往返', async () => {
    const ed = await createEditor('')
    const out = roundTrip(ed, '!!! note')
    expect(out).toBe('!!! note\n')
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('标题含双引号：无引号形式序列化且往返稳定', async () => {
    const ed = await createEditor('')
    const out = roundTrip(ed, '!!! note 说 "你好"\n    内容')
    expect(out).toBe('!!! note 说 "你好"\n    内容\n')
    expect(roundTrip(ed, out)).toBe(out)
  })

  it('::: 容器行为不变，syntax attr 为 colon（WYSIWYG 新建默认）', async () => {
    const ed = await createEditor('::: tip\n冒号内容\n\n:::')
    expect(firstAdmonitionAttrs(ed)?.syntax).toBe('colon')
    expect(ed.action(getMarkdown())).toBe('::: tip\n冒号内容\n\n:::\n')
  })

  it('围栏代码块内的 !!! 不转换（无 admonition 节点，文本保留）', async () => {
    const src = '```text\n!!! note\n    不是提示框\n```'
    const ed = await createEditor(src)
    expect(firstAdmonitionAttrs(ed)).toBeNull()
    const out = ed.action(getMarkdown())
    expect(out).toContain('!!! note')
    expect(out).toContain('```text')
  })

  it('::: 容器内的 !!! 不转换且无 :::! 泄漏', async () => {
    const src = '::: note\n!!! tip\n    不转换\n:::'
    const ed = await createEditor(src)
    const out = ed.action(getMarkdown())
    expect(out).not.toContain(':::!')
    expect(out).toContain('!!! tip')
  })

  it('bang 内容含 ::: 标记时不转换且无 :::! 泄漏（防源码改写）', async () => {
    const src = '!!! note\n    ::: tip\n    内容'
    const ed = await createEditor(src)
    const out = ed.action(getMarkdown())
    expect(out).not.toContain(':::!')
    expect(out).toContain('!!! note')
    expect(out).toContain('::: tip')
  })

  it('引用内的 !!! 保持原文往返（已知边界：WYSIWYG 不转换，不损坏）', async () => {
    const src = '> !!! note\n>     引用内'
    const ed = await createEditor(src)
    const out = ed.action(getMarkdown())
    expect(out).not.toContain(':::!')
    expect(out).toContain('!!! note')
  })
})
