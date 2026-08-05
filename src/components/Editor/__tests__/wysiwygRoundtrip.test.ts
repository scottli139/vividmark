/**
 * WYSIWYG markdown 往返稳定性测试（spike 关键验收点）
 *
 * 验证 Milkdown（commonmark + gfm）对 VividMark 扩展语法的降级与往返行为：
 * - admonition（::: tip）：编辑器不识别，降级为普通段落文本，序列化回源码不丢失
 * - plantuml 代码块：按普通代码块处理，语言标记保留
 * - 任务列表 / 图片 / 表格：GFM 原生支持，往返保留
 * - 二次往返必须稳定（序列化不动点）
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

const DOC = `# 标题

::: tip
这是 **提示** 内容
:::

::: warning 自定义标题
警告内容
:::

\`\`\`plantuml
@startuml
Alice -> Bob: hello
@enduml
\`\`\`

- [ ] 任务一
- [x] 任务二 \`code\`

![本地图片](./assets/x.png)
![网络图片](https://example.com/y.png)

| 列 A | 列 B |
| ---- | ---- |
| 1    | 2    |

> 引用

~~删除线~~ 结尾
`

describe('wysiwyg markdown round-trip', () => {
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

  it('should preserve admonition syntax through round-trip', async () => {
    const ed = await createEditor(DOC)
    const out = ed.action(getMarkdown())

    // admonition 不识别：降级为普通段落文本，但源码字符不丢失
    expect(out).toContain('::: tip')
    expect(out).toContain('这是 **提示** 内容')
    expect(out).toContain(':::')
    expect(out).toContain('::: warning 自定义标题')
    expect(out).toContain('警告内容')
  })

  it('should preserve plantuml code fence with language tag', async () => {
    const ed = await createEditor(DOC)
    const out = ed.action(getMarkdown())

    expect(out).toContain('```plantuml')
    expect(out).toContain('@startuml')
    expect(out).toContain('Alice -> Bob: hello')
    expect(out).toContain('@enduml')
  })

  it('should preserve task list checked states', async () => {
    const ed = await createEditor(DOC)
    const out = ed.action(getMarkdown())

    expect(out).toMatch(/\[[ ]\] 任务一/)
    expect(out).toMatch(/\[[xX]\] 任务二/)
  })

  it('should preserve image syntax and relative paths', async () => {
    const ed = await createEditor(DOC)
    const out = ed.action(getMarkdown())

    expect(out).toContain('![本地图片](./assets/x.png)')
    expect(out).toContain('![网络图片](https://example.com/y.png)')
  })

  it('should preserve tables, quotes and strikethrough', async () => {
    const ed = await createEditor(DOC)
    const out = ed.action(getMarkdown())

    expect(out).toMatch(/\|\s*列 A\s*\|\s*列 B\s*\|/)
    expect(out).toContain('> 引用')
    expect(out).toContain('~~删除线~~')
  })

  it('should reach a fixed point after the first serialization', async () => {
    const ed = await createEditor(DOC)
    const first = ed.action(getMarkdown())
    ed.action(replaceAll(first, true))
    const second = ed.action(getMarkdown())

    // 首次往返允许规范化差异（如 - → * 列表符号），二次往返必须稳定
    expect(second).toBe(first)
  })

  describe('input rules（输入即时渲染）', () => {
    function typeText(view: EditorView, text: string, from: number, to: number) {
      // 模拟 ProseMirror 文本输入路径，触发 input rules
      const handled = view.someProp('handleTextInput', (f) =>
        f(view, from, to, text, () => view.state.tr.insertText(text, from, to))
      )
      if (!handled) {
        view.dispatch(view.state.tr.insertText(text, from, to))
      }
    }

    function type(view: EditorView, text: string) {
      let pos = view.state.selection.from
      for (const char of text) {
        typeText(view, char, pos, pos)
        pos += 1
      }
    }

    it('"# " converts paragraph to heading', async () => {
      const ed = await createEditor('')
      const view = ed.action((ctx) => ctx.get(editorViewCtx))

      type(view, '# ')

      expect(view.state.doc.firstChild?.type.name).toBe('heading')
      expect(view.state.doc.firstChild?.attrs.id).toBeDefined()
    })

    it('"**bold**" applies strong mark', async () => {
      const ed = await createEditor('')
      const view = ed.action((ctx) => ctx.get(editorViewCtx))

      type(view, '**bold**')

      const paragraph = view.state.doc.firstChild!
      expect(paragraph.type.name).toBe('paragraph')
      expect(paragraph.firstChild?.marks.map((m) => m.type.name)).toContain('strong')
    })

    it('"- [ ] " creates a task list item', async () => {
      const ed = await createEditor('')
      const view = ed.action((ctx) => ctx.get(editorViewCtx))

      type(view, '- [ ] ')

      const list = view.state.doc.firstChild!
      expect(list.type.name).toBe('bullet_list')
      const item = list.firstChild!
      expect(item.type.name).toBe('list_item')
      expect(item.attrs.checked).toBe(false)
    })

    it('"|2x3| " inserts a table', async () => {
      const ed = await createEditor('')
      const view = ed.action((ctx) => ctx.get(editorViewCtx))

      type(view, '|2x3| ')

      expect(view.state.doc.firstChild?.type.name).toBe('table')
    })
  })
})
