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

  describe('空段落序列化（preserve-empty-line 已剔除）', () => {
    it('empty paragraph between blocks serializes as blank lines, not <br />', async () => {
      const ed = await createEditor('```js\na\n```\n\n```js\nb\n```')
      const view = ed.action((ctx) => ctx.get(editorViewCtx))
      // 两代码块之间插一个空段落（如「在下方插入段落」后未输入）
      const pos = view.state.doc.firstChild!.nodeSize
      view.dispatch(view.state.tr.insert(pos, view.state.schema.nodes.paragraph.create()))

      const out = ed.action(getMarkdown())
      expect(out).not.toContain('<br')
      expect(out).toContain('```js')
    })

    it('existing standalone <br /> line in source parses to html node and round-trips', async () => {
      const ed = await createEditor('```js\na\n```\n\n<br />\n\n```js\nb\n```')
      const out = ed.action(getMarkdown())

      // 已有 <br /> 不丢失（解析为 html 节点，序列化保留）
      expect(out).toContain('<br />')
      expect(out.match(/```js/g)?.length).toBe(2)
    })

    it('empty table cell serializes without <br /> and stays a valid table', async () => {
      const ed = await createEditor('| A | B |\n| --- | --- |\n| 1 | 2 |')
      const view = ed.action((ctx) => ctx.get(editorViewCtx))
      // 清空一个单元格
      let cellPos = -1
      view.state.doc.descendants((node, nodePos) => {
        if (cellPos < 0 && node.isText && node.text === '2') cellPos = nodePos
        return true
      })
      view.dispatch(view.state.tr.delete(cellPos, cellPos + 1))

      const out = ed.action(getMarkdown())
      expect(out).not.toContain('<br')
      expect(out).toMatch(/\|\s*A\s*\|\s*B\s*\|/)
    })
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

  describe('frontmatter（只读 atom 节点）', () => {
    const FM_DOC = '---\ntitle: 指南\ndraft: false\n---\n\n# 正文标题\n\n内容'

    it('解析为 frontmatter 节点，YAML 原文逐字节存 attrs.value', async () => {
      const ed = await createEditor(FM_DOC)
      const view = ed.action((ctx) => ctx.get(editorViewCtx))

      const first = view.state.doc.firstChild!
      expect(first.type.name).toBe('frontmatter')
      expect(first.attrs.value).toBe('title: 指南\ndraft: false')
    })

    it('往返序列化保留 frontmatter 围栏与原文', async () => {
      const ed = await createEditor(FM_DOC)
      const out = ed.action(getMarkdown())

      expect(out).toMatch(/^---\ntitle: 指南\ndraft: false\n---/)
      expect(out).toContain('# 正文标题')
      expect(out).toContain('内容')
    })

    it('整篇仅 frontmatter 时往返不丢失', async () => {
      const ed = await createEditor('---\ntitle: only\n---\n')
      const out = ed.action(getMarkdown())

      expect(out).toMatch(/^---\ntitle: only\n---/)
    })

    it('二次往返稳定（序列化不动点）', async () => {
      const ed = await createEditor(FM_DOC)
      const first = ed.action(getMarkdown())
      ed.action(replaceAll(first, true))
      const second = ed.action(getMarkdown())

      expect(second).toBe(first)
    })

    it('文档中间的 --- 不解析为 frontmatter（仍是分割线）', async () => {
      const ed = await createEditor('# A\n\n---\n\n# B')
      const view = ed.action((ctx) => ctx.get(editorViewCtx))

      let hasFrontmatter = false
      view.state.doc.descendants((node) => {
        if (node.type.name === 'frontmatter') hasFrontmatter = true
        return true
      })
      expect(hasFrontmatter).toBe(false)
    })
  })

  describe('GitHub Alerts（blockquote 首行标记，零 schema 变更）', () => {
    it('标记行与引用结构往返保留', async () => {
      const ed = await createEditor('> [!NOTE]\n> 提示内容')
      const out = ed.action(getMarkdown())

      // Milkdown 序列化把 `[` 转义防误判链接（`\[` 渲染语义相同）；软换行为普通换行
      expect(out).toMatch(/^> \\?\[!NOTE\]$/m)
      expect(out).toMatch(/^> 提示内容$/m)
    })

    it('空 alert（仅标记行）往返保留', async () => {
      const ed = await createEditor('> [!WARNING]')
      const out = ed.action(getMarkdown())

      expect(out).toMatch(/^> \\?\[!WARNING\]$/m)
    })

    it('未知类型标记原样保留（降级普通引用）', async () => {
      const ed = await createEditor('> [!ABSTRACT]\n> 摘要')
      const out = ed.action(getMarkdown())

      expect(out).toContain('[!ABSTRACT]')
      expect(out).toContain('摘要')
    })

    it('二次往返稳定（序列化不动点）', async () => {
      const ed = await createEditor('> [!NOTE]\n> 提示内容\n\n> [!CAUTION]\n> 危险内容')
      const first = ed.action(getMarkdown())
      ed.action(replaceAll(first, true))
      const second = ed.action(getMarkdown())

      expect(second).toBe(first)
    })
  })

  describe('脚注（gfm 预设自带节点，remark-gfm 解析/序列化）', () => {
    it('引用与定义对应关系往返保留', async () => {
      const ed = await createEditor(
        '正文引用[^1]与[^note]。\n\n[^1]: 第一条。\n\n[^note]: 命名脚注。'
      )
      const out = ed.action(getMarkdown())

      expect(out).toContain('[^1]')
      expect(out).toContain('[^note]')
      expect(out).toMatch(/\[\^1\]:\s*第一条。/)
      expect(out).toMatch(/\[\^note\]:\s*命名脚注。/)
    })

    it('同一引用多次出现往返保留', async () => {
      const ed = await createEditor('首次[^1]，再次[^1]。\n\n[^1]: 共享定义。')
      const out = ed.action(getMarkdown())

      expect(out.match(/\[\^1\](?!:)/g)?.length).toBe(2)
      expect(out).toContain('[^1]: 共享定义。')
    })

    it('未被引用的定义往返保留（不丢内容）', async () => {
      const ed = await createEditor('正文[^1]。\n\n[^1]: 被引用。\n\n[^unused]: 孤立定义。')
      const out = ed.action(getMarkdown())

      expect(out).toContain('[^unused]: 孤立定义。')
    })

    it('多行定义（缩进续行）往返保留', async () => {
      const ed = await createEditor('引用[^1]。\n\n[^1]: 第一行\n    续行内容。')
      const out = ed.action(getMarkdown())

      expect(out).toContain('第一行')
      expect(out).toContain('续行内容。')
    })

    it('定义位置不归一化（书写在中部则保持在中部）', async () => {
      const ed = await createEditor('前文[^1]。\n\n[^1]: 中部定义。\n\n后文。')
      const out = ed.action(getMarkdown())

      const refPos = out.indexOf('前文')
      const defPos = out.indexOf('[^1]: 中部定义。')
      const tailPos = out.indexOf('后文。')
      expect(defPos).toBeGreaterThan(refPos)
      expect(tailPos).toBeGreaterThan(defPos)
    })

    it('二次往返稳定（序列化不动点）', async () => {
      const ed = await createEditor(
        '引用[^a]与[^b]，再引[^a]。\n\n[^a]: 定义 A。\n\n[^b]: 定义 B\n    续行。\n\n[^c]: 孤立。'
      )
      const first = ed.action(getMarkdown())
      ed.action(replaceAll(first, true))
      const second = ed.action(getMarkdown())

      expect(second).toBe(first)
    })
  })
})
