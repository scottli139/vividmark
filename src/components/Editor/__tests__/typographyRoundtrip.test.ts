/**
 * 排版增强语法（==mark== / ^sup^ / ~sub~）WYSIWYG 往返测试（FR-023.4）
 *
 * 验收要点：
 * - 三种语法解析为真正的 PM mark（非字面文本透传），序列化恒回原始分隔符
 * - `~~` 删除线不受 singleTilde: false 影响；单 `~` 归下标（pandoc/Typora 式）
 * - flanking 行为与 GFM strikethrough 对齐（字内可配对、空白相邻不配对）
 * - 字面分隔字符序列化转义（`=` 成对转义第二个、`^` 全转义），重解析不误判
 * - 既有语法（脚注 `[^1]`、代码区、链接 destination）不受新分隔符影响
 * - 二次往返不动点
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('typography (==mark== / ^sup^ / ~sub~) round-trip', () => {
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

  function roundTrip(out: string): Promise<string> {
    editor!.action(replaceAll(out, true))
    return Promise.resolve(editor!.action(getMarkdown()))
  }

  /** 收集文档中出现过 mark 类型的名字 */
  function collectMarkNames(ed: Editor): string[] {
    const view = ed.ctx.get(editorViewCtx)
    const names = new Set<string>()
    view.state.doc.descendants((node) => {
      node.marks.forEach((m) => names.add(m.type.name))
    })
    return [...names]
  }

  it('should parse ==mark== into a real PM mark and serialize back', async () => {
    const ed = await createEditor('这是 ==高亮内容== 文字')
    expect(collectMarkNames(ed)).toContain('mark')
    expect(ed.action(getMarkdown())).toContain('==高亮内容==')
  })

  it('should parse ^sup^ into a real PM mark and serialize back', async () => {
    const ed = await createEditor('E = mc^2^ 公式')
    expect(collectMarkNames(ed)).toContain('superscript')
    expect(ed.action(getMarkdown())).toContain('mc^2^')
  })

  it('should parse ~sub~ into a real PM mark and serialize back', async () => {
    const ed = await createEditor('水的化学式 H~2~O')
    expect(collectMarkNames(ed)).toContain('subscript')
    expect(ed.action(getMarkdown())).toContain('H~2~O')
  })

  it('should keep ~~strikethrough~~ as strike_through (singleTilde off)', async () => {
    const ed = await createEditor('~~删除线~~ 结尾')
    const marks = collectMarkNames(ed)
    expect(marks).toContain('strike_through')
    expect(marks).not.toContain('subscript')
    expect(ed.action(getMarkdown())).toContain('~~删除线~~')
  })

  it('should treat single ~ as subscript, not strikethrough', async () => {
    const ed = await createEditor('~下标~ 文字')
    const marks = collectMarkNames(ed)
    expect(marks).toContain('subscript')
    expect(marks).not.toContain('strike_through')
    expect(ed.action(getMarkdown())).toContain('~下标~')
  })

  it('should support intraword pairs (H~2~O / a==b==c / x^2^y)', async () => {
    const ed = await createEditor('H~2~O 与 a==b==c 与 x^2^y')
    const out = ed.action(getMarkdown())
    expect(out).toContain('H~2~O')
    expect(out).toContain('a==b==c')
    expect(out).toContain('x^2^y')
  })

  it('should not pair sequences adjacent to whitespace (== x == stays literal)', async () => {
    const ed = await createEditor('== x == 与 ~ x~ 与 ^x ^')
    const marks = collectMarkNames(ed)
    expect(marks).not.toContain('mark')
    expect(marks).not.toContain('subscript')
    expect(marks).not.toContain('superscript')
    // 字面文本重序列化可转义但语义必须是纯文本（不动点内验证）
    const first = ed.action(getMarkdown())
    const second = await roundTrip(first)
    expect(second).toBe(first)
  })

  it('should nest emphasis inside ==mark==', async () => {
    const ed = await createEditor('==含 **加粗** 与 *斜体*==')
    const marks = collectMarkNames(ed)
    expect(marks).toContain('mark')
    const out = ed.action(getMarkdown())
    expect(out).toContain('==含 **加粗** 与 *斜体*==')
  })

  it('should escape literal == in plain text (second = only) and stay stable', async () => {
    const ed = await createEditor('a == b 不是高亮')
    const first = ed.action(getMarkdown())
    // 第一个 `=` 不转义（单 `=` 永不构成分隔符），第二个转义防重解析误判
    expect(first).toContain('a =\\= b')
    const second = await roundTrip(first)
    expect(second).toBe(first)
  })

  it('should not mangle single = in plain text', async () => {
    const ed = await createEditor('等式 a = b 保持')
    const first = ed.action(getMarkdown())
    expect(first).toContain('a = b')
    expect(first).not.toContain('\\=')
    expect(await roundTrip(first)).toBe(first)
  })

  it('should escape literal ^ in plain text and stay stable', async () => {
    const ed = await createEditor('异或 a ^ b 运算')
    const first = ed.action(getMarkdown())
    expect(first).toContain('a \\^ b')
    expect(await roundTrip(first)).toBe(first)
  })

  it('should keep footnote references unaffected by the caret construct', async () => {
    const ed = await createEditor('引用[^1] 文字\n\n[^1]: 脚注定义')
    const first = ed.action(getMarkdown())
    expect(first).toContain('[^1]')
    expect(first).toContain('[^1]: 脚注定义')
    expect(first).not.toContain('\\[^1\\]')
    expect(await roundTrip(first)).toBe(first)
  })

  it('should keep delimiters literal inside code spans and code blocks', async () => {
    const ed = await createEditor('`==x==` 与 `~y~`\n\n```\n==z== ^w^\n```')
    const first = ed.action(getMarkdown())
    expect(first).toContain('`==x==`')
    expect(first).toContain('`~y~`')
    expect(first).toContain('==z== ^w^')
    expect(await roundTrip(first)).toBe(first)
  })

  it('should keep emoji shortcode as literal text in WYSIWYG', async () => {
    const ed = await createEditor('笑脸 :smile: 文本')
    const first = ed.action(getMarkdown())
    expect(first).toContain(':smile:')
    expect(await roundTrip(first)).toBe(first)
  })

  it('should keep ^ in link destinations unescaped', async () => {
    const ed = await createEditor('[链接](https://example.com/a^b)')
    const first = ed.action(getMarkdown())
    expect(first).toContain('https://example.com/a^b')
    expect(await roundTrip(first)).toBe(first)
  })

  it('should reach a fixed point after the first serialization', async () => {
    const ed = await createEditor(
      '==高亮== 与 ^上标^ 与 ~下标~\n\n~~删除~~ 与 [^a]\n\n[^a]: 定义\n'
    )
    const first = ed.action(getMarkdown())
    const second = await roundTrip(first)
    expect(second).toBe(first)
  })
})
