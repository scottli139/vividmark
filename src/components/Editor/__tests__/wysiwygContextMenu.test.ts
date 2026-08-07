/**
 * WYSIWYG 右键菜单：上下文解析（resolveWysiwygContext）与上下文动作
 * （applyWysiwygContextAction）的测试。表格行列删除走自实现 PM transaction，
 * 需验证 markdown 往返结果；链接/图片/代码块同理。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { TextSelection } from '@milkdown/kit/prose/state'
import { getMarkdown } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'
import { applyWysiwygContextAction, resolveWysiwygContext } from '../wysiwygContextMenu'

const TABLE_MD = ['| A | B |', '| --- | --- |', '| 1 | 2 |', '| 3 | 4 |'].join('\n')

describe('wysiwyg context menu', () => {
  let editor: Editor | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    await editor?.destroy()
    editor = null
    container?.remove()
    container = null
    vi.restoreAllMocks()
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

  /** 光标落到包含 target 的文本节点中间 */
  function cursorOnText(view: EditorView, target: string) {
    let pos = -1
    view.state.doc.descendants((node, nodePos) => {
      if (pos >= 0) return false
      if (node.isText && node.text?.includes(target)) {
        pos = nodePos + Math.max(1, node.text.indexOf(target) + 1)
        return false
      }
      return true
    })
    if (pos < 0) throw new Error(`text not found: ${target}`)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
  }

  function act(ed: Editor, id: string): boolean {
    return ed.action((ctx) => applyWysiwygContextAction(ctx, id))
  }

  describe('resolveWysiwygContext', () => {
    it('plain paragraph: all flags false', async () => {
      const ed = await createEditor('hello world')
      const view = getView(ed)
      cursorOnText(view, 'hello')
      expect(resolveWysiwygContext(view)).toEqual({
        inTable: false,
        inTableHeader: false,
        linkHref: undefined,
        onImage: false,
        inCodeBlock: false,
      })
    })

    it('cursor on link mark exposes href', async () => {
      const ed = await createEditor('see [docs](https://example.com) now')
      const view = getView(ed)
      cursorOnText(view, 'docs')
      expect(resolveWysiwygContext(view).linkHref).toBe('https://example.com')
    })

    it('table body cell vs header row', async () => {
      const ed = await createEditor(TABLE_MD)
      const view = getView(ed)

      cursorOnText(view, '3')
      let context = resolveWysiwygContext(view)
      expect(context.inTable).toBe(true)
      expect(context.inTableHeader).toBe(false)

      cursorOnText(view, 'A')
      context = resolveWysiwygContext(view)
      expect(context.inTable).toBe(true)
      expect(context.inTableHeader).toBe(true)
    })

    it('code block and image contexts', async () => {
      const ed = await createEditor('```\nconst a = 1\n```')
      const view = getView(ed)
      cursorOnText(view, 'const')
      expect(resolveWysiwygContext(view).inCodeBlock).toBe(true)

      const ed2 = await createEditor('![alt](./assets/a.png)')
      const view2 = getView(ed2)
      // 光标落到图片节点后（atom 节点相邻位置）
      let imagePos = -1
      view2.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
          imagePos = pos
          return false
        }
        return true
      })
      view2.dispatch(
        view2.state.tr.setSelection(TextSelection.create(view2.state.doc, imagePos + 1))
      )
      expect(resolveWysiwygContext(view2).onImage).toBe(true)
    })
  })

  describe('table actions', () => {
    it('add-row-after inserts a row below current row', async () => {
      const ed = await createEditor(TABLE_MD)
      const view = getView(ed)
      cursorOnText(view, '1')

      expect(act(ed, 'table:add-row-after')).toBe(true)

      const markdown = ed.action(getMarkdown())
      // 原 2 行数据 → 3 行；空行插入在第 1 行数据之后（序列化会补齐单元格空格）
      expect(markdown).toMatch(/\|\s*3\s*\|\s*4\s*\|/)
      expect(markdown.split('\n').filter((l) => l.trim().startsWith('|')).length).toBe(4 + 1)
    })

    it('delete-row removes current row but keeps header intact', async () => {
      const ed = await createEditor(TABLE_MD)
      const view = getView(ed)
      cursorOnText(view, '1')

      expect(act(ed, 'table:delete-row')).toBe(true)

      const markdown = ed.action(getMarkdown())
      expect(markdown).not.toMatch(/\|\s*1\s*\|\s*2\s*\|/)
      expect(markdown).toMatch(/\|\s*3\s*\|\s*4\s*\|/)
      expect(markdown).toMatch(/\|\s*A\s*\|\s*B\s*\|/)
    })

    it('delete-row on header row is rejected', async () => {
      const ed = await createEditor(TABLE_MD)
      const view = getView(ed)
      cursorOnText(view, 'A')

      expect(act(ed, 'table:delete-row')).toBe(false)
      expect(ed.action(getMarkdown())).toMatch(/\|\s*A\s*\|\s*B\s*\|/)
    })

    it('delete-col removes current column from all rows', async () => {
      const ed = await createEditor(TABLE_MD)
      const view = getView(ed)
      cursorOnText(view, '2')

      expect(act(ed, 'table:delete-col')).toBe(true)

      const markdown = ed.action(getMarkdown())
      expect(markdown).not.toMatch(/\bB\b/)
      expect(markdown).not.toMatch(/\|\s*2\s*\|/)
      expect(markdown).toMatch(/\|\s*A\s*\|/)
      expect(markdown).toMatch(/\|\s*1\s*\|/)
    })

    it('delete-table removes the whole table', async () => {
      const ed = await createEditor(`before\n\n${TABLE_MD}\n\nafter`)
      const view = getView(ed)
      cursorOnText(view, '1')

      expect(act(ed, 'table:delete-table')).toBe(true)

      const markdown = ed.action(getMarkdown())
      expect(markdown).not.toContain('| A |')
      expect(markdown).toContain('before')
      expect(markdown).toContain('after')
    })
  })

  describe('link / image / code block actions', () => {
    it('link:remove keeps text, drops mark', async () => {
      const ed = await createEditor('see [docs](https://example.com) now')
      const view = getView(ed)
      cursorOnText(view, 'docs')

      expect(act(ed, 'link:remove')).toBe(true)

      const markdown = ed.action(getMarkdown())
      expect(markdown).not.toContain('](')
      expect(markdown).toContain('docs')
    })

    it('image:delete removes the image node', async () => {
      const ed = await createEditor('x ![alt](./assets/a.png) y')
      const view = getView(ed)
      let imageEnd = -1
      view.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
          imageEnd = pos + node.nodeSize
          return false
        }
        return true
      })
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, imageEnd)))

      expect(act(ed, 'image:delete')).toBe(true)
      expect(ed.action(getMarkdown())).not.toContain('![')
    })

    it('codeblock:copy writes code to clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText, readText: vi.fn() },
        configurable: true,
      })
      const ed = await createEditor('```\nconst a = 1\n```')
      const view = getView(ed)
      cursorOnText(view, 'const')

      expect(act(ed, 'codeblock:copy')).toBe(true)
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('const a = 1'))
    })
  })

  describe('clipboard / selection actions', () => {
    it('select-all selects the whole document', async () => {
      const ed = await createEditor('hello world')
      getView(ed)

      expect(act(ed, 'select-all')).toBe(true)

      const view = getView(ed)
      expect(view.state.selection.from).toBe(0)
      expect(view.state.selection.to).toBe(view.state.doc.content.size)
    })

    it('copy writes selected text; cut additionally removes it', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText, readText: vi.fn().mockResolvedValue('') },
        configurable: true,
      })
      const ed = await createEditor('hello world')
      const view = getView(ed)
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)))

      expect(act(ed, 'copy')).toBe(true)
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('hello'))
      expect(ed.action(getMarkdown())).toContain('hello world')

      expect(act(ed, 'cut')).toBe(true)
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('hello'))
      expect(ed.action(getMarkdown())).not.toContain('hello')
    })
  })
})
