import type { EditorState } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'

/**
 * IME 组合输入残留垃圾清理（WKWebView + 中文 IME）
 *
 * 组合输入期间，浏览器在 DOM 里插入的占位节点会被 PM 的 DOM 回读收编为
 * hardbreak 节点（序列化成 `\` 垃圾行）或空格文本（macOS 拼音预编辑文本的
 * 分音节空格 span 残留）。本插件清理三类垃圾：
 * 1. 「纯 hardbreak 段落」——是父容器唯一子节点时替换为空段落
 *    （满足 admonition 等 `block+` 内容约束），否则整段删除；
 * 2. 文本段落内「≥2 个连续的非 inline hardbreak 运行段」——合法的
 *    Shift+Enter 硬换行只会产生单个 hardbreak（Milkdown 的
 *    insertHardbreakCommand 会把连续第二次 Shift+Enter 折叠成新段落），
 *    单个尾随/行间 hardbreak 一律保留；
 * 3. 文本块内「≥3 个连续 ASCII 空格」运行段——≤2 个空格保留
 *    （两空格硬换行等合法用法）；代码块不动。
 *
 * 时机与守卫：
 * - 仅处理带 `composition` meta 的事务（PM 的 readDOMChange 会给 IME 组合
 *   期间的 DOM 回读事务打标）；普通编辑、粘贴、文件加载不触发清理，
 *   不会误伤用户源码中合法的硬换行/多空格内容；
 * - **上屏事务 dispatch 时 PM 仍处于 composing 状态**（compositionend 事件
 *   在事务之后才到），此时不能 dispatch（会打断 composition）——记录
 *   待清理标记，等 compositionend 后延迟 50ms 统一清理（晚于 PM 的
 *   scheduleComposeEnd 20ms flush）。若清理时新一轮组合已开始，则顺延到
 *   下一轮组合结束。
 */

/** 组合结束后延迟清理的等待时间（必须 > PM 的 scheduleComposeEnd 20ms flush） */
const DEFER_MS = 50

interface Edit {
  from: number
  to: number
  /** true = 替换为空段落而非删除（父容器唯一子节点，满足 block+ 约束） */
  replace: boolean
}

/** 收集文档中的残留垃圾编辑（供事务路径与延迟清理共用） */
function collectEdits(state: EditorState): Edit[] {
  const edits: Edit[] = []

  state.doc.descendants((node, pos, parent) => {
    if (!node.isTextblock) return true

    let total = 0
    let breaks = 0
    node.forEach((child) => {
      total++
      if (child.type.name === 'hardbreak') breaks++
    })
    if (breaks === 0) return false

    if (breaks === total) {
      // 规则 1：纯 hardbreak 段落
      edits.push({
        from: pos,
        to: pos + node.nodeSize,
        replace: (parent?.childCount ?? 0) === 1,
      })
      return false
    }

    // 规则 2：混合内容中 ≥2 连续的非 inline hardbreak 运行段
    let runStart = -1
    const closeRun = (runEnd: number) => {
      if (runStart >= 0 && runEnd - runStart >= 2) {
        edits.push({ from: pos + 1 + runStart, to: pos + 1 + runEnd, replace: false })
      }
      runStart = -1
    }
    node.forEach((child, offset) => {
      const isPhantomBreak = child.type.name === 'hardbreak' && child.attrs.isInline === false
      if (isPhantomBreak) {
        if (runStart < 0) runStart = offset
      } else {
        closeRun(offset)
      }
    })
    closeRun(node.content.size)
    return false
  })

  // 规则 3：≥3 连续 ASCII 空格运行段（预编辑文本分音节空格残留）
  state.doc.descendants((node, pos) => {
    if (!node.isTextblock || node.type.name === 'code_block') return true
    node.forEach((child, offset) => {
      if (!child.isText || !child.text) return
      const re = / {3,}/g
      let match: RegExpExecArray | null
      while ((match = re.exec(child.text)) !== null) {
        const from = pos + 1 + offset + match.index
        edits.push({ from, to: from + match[0].length, replace: false })
      }
    })
    return false
  })

  return edits
}

export const hardbreakCleanupPlugin = $prose(() => {
  let view: EditorView | null = null
  /** 有待清理垃圾但当前不能 dispatch（组合进行中）；组合结束后补一轮 */
  let pendingCleanup = false
  let deferTimer: ReturnType<typeof setTimeout> | null = null

  const applyEdits = (state: EditorState) => {
    const edits = collectEdits(state)
    if (edits.length === 0) return null
    // 从后往前应用，保持前面位置有效
    const tr = state.tr
    for (let i = edits.length - 1; i >= 0; i--) {
      const { from, to, replace } = edits[i]
      if (replace) {
        tr.replaceWith(from, to, state.schema.nodes.paragraph.create())
      } else {
        tr.delete(from, to)
      }
    }
    return tr
  }

  /** 组合结束后的延迟清理：组合中又顺延，直到用户停下来 */
  const runDeferredCleanup = () => {
    deferTimer = null
    const v = view
    if (!v || !v.docView) return
    if (v.composing) {
      // 新一轮组合已开始，顺延到它的 compositionend
      pendingCleanup = true
      return
    }
    pendingCleanup = false
    const tr = applyEdits(v.state)
    if (tr) v.dispatch(tr)
  }

  return new Plugin({
    key: new PluginKey('vividmark-hardbreak-cleanup'),
    view: (v) => {
      view = v
      return {
        destroy: () => {
          if (deferTimer) clearTimeout(deferTimer)
          view = null
        },
      }
    },
    appendTransaction: (trs, _oldState, newState) => {
      if (!trs.some((tr) => tr.docChanged)) return null
      // 仅清理 IME 组合相关事务（PM 的 readDOMChange 会打 composition meta）
      if (!trs.some((tr) => tr.getMeta('composition') != null)) return null
      if (view?.composing) {
        // 组合进行中不能 dispatch——记录标记，compositionend 后统一清理
        pendingCleanup = true
        return null
      }
      return applyEdits(newState)
    },
    props: {
      handleDOMEvents: {
        compositionend: () => {
          if (!pendingCleanup) return
          if (deferTimer) clearTimeout(deferTimer)
          deferTimer = setTimeout(runDeferredCleanup, DEFER_MS)
        },
      },
    },
  })
})
