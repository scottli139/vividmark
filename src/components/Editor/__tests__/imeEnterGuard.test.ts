/**
 * IME 快速回车换行补偿测试（Safari/WKWebView 的 PM kludge workaround，v3）
 *
 * PM 的 inOrNearComposition：Apple WebKit 系（vendor 含 Apple）浏览器在
 * compositionend 后 500ms 内吞掉第一个非组合态 keydown——中文用户「选词上屏
 * 后立刻回车」的 Enter 会被吞，新行内容拼接到上一行。本插件在 view.dom 的
 * capture 阶段接管该 Enter（stopImmediatePropagation + 手动 splitBlock），
 * 并直接读写 PM 的 input.compositionEndedAt 保持与 kludge 同步。
 *
 * jsdom 里 navigator.vendor 为空，插件惰性退出；Apple 场景用 vendor stub +
 * 直接写入 PM 的 compositionEndedAt 时间戳来构造吞没窗口。补偿事务带
 * IME_GUARD_META，用探针插件计数（验证有且仅有一次分段）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import type { EditorView } from '@milkdown/kit/prose/view'
import { Plugin, TextSelection } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'
import { IME_GUARD_META } from '../imeEnterGuardPlugin'
import { wysiwygPlugins } from '../wysiwygPlugins'

const originalVendor = navigator.vendor

let guardCompensations = 0

/** 探针：统计带 IME_GUARD_META 的补偿事务数 */
const guardProbe = $prose(() => {
  return new Plugin({
    appendTransaction: (trs) => {
      for (const tr of trs) {
        if (tr.getMeta(IME_GUARD_META)) guardCompensations++
      }
      return null
    },
  })
})

function stubAppleVendor() {
  Object.defineProperty(navigator, 'vendor', {
    value: 'Apple Computer, Inc.',
    configurable: true,
  })
}

/** 直接写 PM 的吞没窗口时间戳（模拟 compositionend 刚发生） */
function setCompositionEndedAt(view: EditorView, t: number) {
  ;(view as unknown as { input: { compositionEndedAt: number } }).input.compositionEndedAt = t
}

describe('imeEnterGuard', () => {
  let editor: Editor | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    guardCompensations = 0
    stubAppleVendor()
  })

  afterEach(async () => {
    Object.defineProperty(navigator, 'vendor', { value: originalVendor, configurable: true })
    vi.restoreAllMocks()
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
      .use(guardProbe)
      .create()
    return editor
  }

  function getView(ed: Editor): EditorView {
    return ed.action((ctx) => ctx.get(editorViewCtx))
  }

  function pressEnter(view: EditorView) {
    view.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    )
  }

  /** 光标移到文档末尾段落内容内 */
  function cursorToEnd(view: EditorView) {
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, view.state.doc.content.size - 1)
      )
    )
  }

  it('compensates a swallowed Enter exactly once (soft break, matching normal Enter)', async () => {
    const ed = await createEditor('你会')
    const view = getView(ed)
    cursorToEnd(view)

    setCompositionEndedAt(view, 100_000)
    vi.spyOn(Date, 'now').mockReturnValue(100_120)
    pressEnter(view)

    // 补偿走 wysiwygEnterCommand：普通段落 = 软换行（isInline hardbreak），不分段
    expect(guardCompensations).toBe(1)
    expect(view.state.doc.childCount).toBe(1)
    const para = view.state.doc.firstChild!
    expect(para.lastChild?.type.name).toBe('hardbreak')
    expect(para.lastChild?.attrs.isInline).toBe(true)
  })

  it('does not double-compensate a second Enter (timestamp reset mirrors the kludge)', async () => {
    const ed = await createEditor('你会')
    const view = getView(ed)
    cursorToEnd(view)

    setCompositionEndedAt(view, 200_000)
    vi.spyOn(Date, 'now').mockReturnValue(200_120)
    pressEnter(view)
    expect(guardCompensations).toBe(1)

    // 第二次回车：时间戳已被插件复位，不再补偿；经正常 Enter 路径
    // （段尾已是软换行 → 折叠为新段落）
    pressEnter(view)
    expect(guardCompensations).toBe(1)
    expect(view.state.doc.childCount).toBe(2)
  })

  it('ignores the machine-paired Enter within 60ms (IME confirm sequence)', async () => {
    const ed = await createEditor('你会')
    const view = getView(ed)

    setCompositionEndedAt(view, 300_000)
    vi.spyOn(Date, 'now').mockReturnValue(300_010)
    pressEnter(view)

    expect(guardCompensations).toBe(0)
  })

  it('ignores Enter outside the swallow window', async () => {
    const ed = await createEditor('你会')
    const view = getView(ed)
    cursorToEnd(view)

    setCompositionEndedAt(view, 400_000)
    vi.spyOn(Date, 'now').mockReturnValue(400_600)
    pressEnter(view)

    expect(guardCompensations).toBe(0)
    // 走正常 Enter 路径（wysiwygEnterCommand）：普通段落 = 软换行，不分段
    expect(view.state.doc.childCount).toBe(1)
    expect(view.state.doc.firstChild?.lastChild?.type.name).toBe('hardbreak')
  })

  it('does not compensate inside a code block', async () => {
    const ed = await createEditor('```js\nconst a = 1\n```')
    const view = getView(ed)
    let codePos = -1
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'code_block') codePos = pos + 1
      return true
    })
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, codePos)))

    setCompositionEndedAt(view, 500_000)
    vi.spyOn(Date, 'now').mockReturnValue(500_120)
    pressEnter(view)

    expect(guardCompensations).toBe(0)
    expect(view.state.doc.childCount).toBe(1)
  })

  it('is inert when navigator.vendor lacks Apple', async () => {
    // 注意：jsdom 的默认 vendor 是 "Apple Computer, Inc."，PM 的 safari 标记在
    // 模块加载时已固化为 true，因此本用例里 PM 的 kludge 仍会吞掉这次 Enter。
    // 这里只验证本插件在 vendor 不含 Apple 时不介入（不补偿）。
    Object.defineProperty(navigator, 'vendor', { value: '', configurable: true })
    const ed = await createEditor('你会')
    const view = getView(ed)

    setCompositionEndedAt(view, 600_000)
    vi.spyOn(Date, 'now').mockReturnValue(600_120)
    pressEnter(view)

    expect(guardCompensations).toBe(0)
    expect(view.state.doc.childCount).toBe(1) // PM kludge 吞掉（jsdom 固化 safari=true）
  })

  it('leaves composition-active (isComposing) Enter to the IME', async () => {
    const ed = await createEditor('你会')
    const view = getView(ed)

    setCompositionEndedAt(view, 700_000)
    vi.spyOn(Date, 'now').mockReturnValue(700_120)
    view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      })
    )

    expect(guardCompensations).toBe(0)
  })
})
