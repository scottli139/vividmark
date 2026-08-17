/**
 * GitHub Alerts WYSIWYG 装饰测试（githubAlertDecorations.ts）
 *
 * v1 纯装饰：blockquote 首段首行 `[!TYPE]` 命中 → NodeDecoration 注入
 * `admonition <type> github-alert` class（复用 admonition 配色）+ 标记文本
 * InlineDecoration（github-alert-marker）。零 schema 变更，标记行可见可编辑。
 * 未知类型 / 同行跟文本 / 带 mark 的标记（对齐预览侧口径）→ 不装饰。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { wysiwygPlugins } from '../wysiwygPlugins'
import { alertTypeOfBlockquote } from '../githubAlertDecorations'

describe('GitHub Alerts WYSIWYG 装饰', () => {
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

  /** 找文档中第一个 blockquote 节点（无则返回 null） */
  function firstBlockquote(ed: Editor) {
    return getView(ed).state.doc.firstChild?.type.name === 'blockquote'
      ? getView(ed).state.doc.firstChild!
      : null
  }

  it('alert blockquote 注入 admonition class 与标记装饰', async () => {
    const ed = await createEditor('> [!NOTE]\n> 提示内容')
    const view = getView(ed)

    const bq = view.dom.querySelector('blockquote')
    expect(bq).not.toBeNull()
    expect(bq!.className).toContain('admonition')
    expect(bq!.className).toContain('note')
    expect(bq!.className).toContain('github-alert')

    const marker = view.dom.querySelector('.github-alert-marker')
    expect(marker?.textContent).toBe('[!NOTE]')
    // 标记行保留为可编辑文本，内容同段落跟随
    expect(bq!.textContent).toContain('提示内容')
  })

  it('各类型与大小写不敏感（[!Warning] → warning class）', async () => {
    const ed = await createEditor('> [!Warning]\n> 内容')
    const bq = getView(ed).dom.querySelector('blockquote')
    expect(bq!.className).toContain('warning')
    expect(getView(ed).dom.querySelector('.github-alert-marker')?.textContent).toBe('[!Warning]')
  })

  it('硬换行形式（往返产物 `> [!NOTE]\\`）同样装饰', async () => {
    const ed = await createEditor('> [!NOTE]\\\n> 往返内容')
    const bq = getView(ed).dom.querySelector('blockquote')
    expect(bq!.className).toContain('github-alert')
    expect(bq!.className).toContain('note')
  })

  it('空 alert（仅标记行）也装饰', async () => {
    const ed = await createEditor('> [!TIP]')
    const bq = getView(ed).dom.querySelector('blockquote')
    expect(bq!.className).toContain('github-alert')
    expect(bq!.className).toContain('tip')
  })

  it('未知类型不装饰', async () => {
    const ed = await createEditor('> [!ABSTRACT]\n> 摘要')
    const bq = getView(ed).dom.querySelector('blockquote')
    expect(bq!.className).not.toContain('github-alert')
    expect(getView(ed).dom.querySelector('.github-alert-marker')).toBeNull()
  })

  it('标记后同行跟文本不装饰', async () => {
    const ed = await createEditor('> [!NOTE] 行内标题\n> 内容')
    const bq = getView(ed).dom.querySelector('blockquote')
    expect(bq!.className).not.toContain('github-alert')
  })

  it('标记行尾跟非文本节点（图片）不装饰', async () => {
    const ed = await createEditor('> [!NOTE] ![a](https://example.com/x.png)')
    expect(firstBlockquote(ed)).not.toBeNull()
    expect(alertTypeOfBlockquote(firstBlockquote(ed)!)).toBeNull()
  })

  it('带 mark 的标记（**[!NOTE]**）不装饰（对齐预览口径）', async () => {
    const ed = await createEditor('> **[!NOTE]**\n> 内容')
    expect(firstBlockquote(ed)).not.toBeNull()
    expect(alertTypeOfBlockquote(firstBlockquote(ed)!)).toBeNull()
    const bq = getView(ed).dom.querySelector('blockquote')
    expect(bq!.className).not.toContain('github-alert')
  })

  it('普通引用块不装饰', async () => {
    const ed = await createEditor('> 普通引用\n> 第二行')
    const bq = getView(ed).dom.querySelector('blockquote')
    expect(bq!.className).not.toContain('github-alert')
    expect(alertTypeOfBlockquote(firstBlockquote(ed)!)).toBeNull()
  })

  it('alertTypeOfBlockquote 返回小写类型', async () => {
    const ed = await createEditor('> [!CAUTION]\n> 内容')
    expect(alertTypeOfBlockquote(firstBlockquote(ed)!)).toBe('caution')
  })
})
