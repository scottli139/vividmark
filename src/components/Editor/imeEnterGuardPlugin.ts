import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { wysiwygEnterCommand } from './wysiwygFormat'

/** PM kludge 的吞没窗口：compositionend 后 500ms 内的第一个 keydown 被忽略 */
const SWALLOW_WINDOW_MS = 500
/**
 * 窗口下界：Safari 在「Enter 确认上屏」时补发的配对 keydown 与 compositionend
 * 几乎同刻到达（同一手势），不该产生换行；人类刻意的回车明显更慢
 */
const PAIR_THRESHOLD_MS = 60

/** 补偿事务的 meta 标记（测试与诊断用） */
export const IME_GUARD_META = 'imeEnterGuardCompensation'

/** 与 PM 的 safari 判定同源（navigator.vendor 含 Apple；WKWebView 命中） */
function isAppleWebKit(): boolean {
  return typeof navigator !== 'undefined' && /Apple Computer/.test(navigator.vendor)
}

/** view.input.compositionEndedAt 的结构化访问（PM 内部字段，kludge 吞没窗口的时间戳） */
function getCompositionEndedAt(view: EditorView): number {
  return (view as unknown as { input: { compositionEndedAt: number } }).input.compositionEndedAt
}

function resetCompositionEndedAt(view: EditorView) {
  ;(view as unknown as { input: { compositionEndedAt: number } }).input.compositionEndedAt = -2e8
}

/**
 * 中文 IME 快速回车换行的补偿（Safari 系 / Tauri WKWebView）
 *
 * PM 的 inOrNearComposition kludge：Apple WebKit 系浏览器里，compositionend
 * 后 500ms 内的第一个非组合态 keydown 会被整个吞掉（本意是吞掉 IME 确认上屏
 * 时 Safari 补发的配对 Enter），且不调 preventDefault。中文用户「选词上屏 →
 * 立刻回车换行」的 Enter 落在该窗口被吞 → 新段落没建成 → 后续组合文本提交
 * 到上一行末尾（「新行拼接到上一行」）。
 *
 * 补偿设计（v3，capture 阶段接管）：
 * - 在 view.dom 的 **capture 阶段**监听 keydown（先于 PM 冒泡阶段的处理器，
 *   不依赖插件注册顺序）；
 * - 直接读 PM 自己的 `input.compositionEndedAt` 判定吞没窗口——不维护任何
 *   镜像状态，与 kludge 天然同步（包括「窗口内只吞第一个键」：PM 吞掉其他
 *   键时会自行复位该时间戳，本插件读到复位值自然跳过）；
 * - 命中窗口内的 Enter：先把时间戳复位（镜像 kludge 事后状态），再
 *   preventDefault + stopImmediatePropagation（PM 不再看到这次按键），
 *   手动 splitBlock——保证有且仅有一次分段；
 * - 60ms 下界：IME 确认上屏的配对 Enter 与 compositionend 同刻到达（同一
 *   手势），放行给 kludge 吞掉（不该换行）；代码块内不补偿（Enter 应插入
 *   `\n` 而非分段）；组合进行中（isComposing）不介入（Enter 交给 IME 确认）。
 */
export const imeEnterGuardPlugin = $prose((ctx) => {
  return new Plugin({
    key: new PluginKey('vividmark-ime-enter-guard'),
    view: (view) => {
      const onKeydownCapture = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented) return
        if (!isAppleWebKit()) return
        if (view.composing) return
        const since = Date.now() - getCompositionEndedAt(view)
        if (since < 0 || since > SWALLOW_WINDOW_MS) return
        // IME 确认上屏的配对 Enter：放行（PM 的 kludge 吞掉它，不该换行）
        if (since < PAIR_THRESHOLD_MS) return
        if (view.state.selection.$from.parent.type.name === 'code_block') return

        // 先镜像 kludge 的事后状态（等价于「PM 已吞」），再完全接管这次按键。
        // 补偿走与正常 Enter 相同的 wysiwygEnterCommand（软换行模型），行为一致
        resetCompositionEndedAt(view)
        event.preventDefault()
        event.stopImmediatePropagation()
        wysiwygEnterCommand(ctx, view.state, (tr) =>
          view.dispatch(tr.setMeta(IME_GUARD_META, true))
        )
      }
      view.dom.addEventListener('keydown', onKeydownCapture, true)
      return {
        destroy: () => view.dom.removeEventListener('keydown', onKeydownCapture, true),
      }
    },
  })
})
