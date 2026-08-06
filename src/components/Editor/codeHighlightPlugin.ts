import hljs from 'highlight.js'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'

/**
 * WYSIWYG 代码块语法高亮（highlight.js → PM inline decorations）
 *
 * 与预览（parser.ts 的 markdown-it highlight）共用同一套 hljs 引擎与
 * globals.css 的 .hljs-* 颜色类，所见即所得与预览视觉一致；不引入新依赖。
 *
 * 只认显式 language（无语言/未知语言/plantuml 跳过）：避免 highlightAuto
 * 误判闪烁与击键开销，行为与 Typora 一致。
 */

/** 一个高亮区间：相对代码块内容起点的偏移 + hljs 类名栈（嵌套 span 类名合并） */
interface HighlightSpan {
  from: number
  to: number
  cls: string
}

/**
 * 高亮结果缓存：key = language + 源码。
 * 每次 docChanged 会重建全部 decorations，缓存保证只有内容变过的块重新分词。
 */
const spanCache = new Map<string, HighlightSpan[]>()
const CACHE_LIMIT = 200

/** 把 hljs.highlight 输出的 HTML 展平成区间列表（递归累计祖先 span 的类名栈） */
function htmlToSpans(html: string): HighlightSpan[] {
  const spans: HighlightSpan[] = []
  const host = document.createElement('div')
  host.innerHTML = html

  let offset = 0
  const walk = (el: globalThis.Node, classStack: string[]) => {
    el.childNodes.forEach((child) => {
      if (child.nodeType === globalThis.Node.TEXT_NODE) {
        const text = child.textContent ?? ''
        if (text.length > 0 && classStack.length > 0) {
          spans.push({ from: offset, to: offset + text.length, cls: classStack.join(' ') })
        }
        offset += text.length
      } else if (child.nodeType === globalThis.Node.ELEMENT_NODE) {
        const classes = (child as HTMLElement).className.split(/\s+/).filter(Boolean)
        walk(child, [...classStack, ...classes])
      }
    })
  }
  walk(host, [])
  return spans
}

function getSpans(language: string, code: string): HighlightSpan[] {
  const key = `${language}\n${code}`
  const cached = spanCache.get(key)
  if (cached) return cached

  let spans: HighlightSpan[] = []
  try {
    spans = htmlToSpans(hljs.highlight(code, { language, ignoreIllegals: true }).value)
  } catch {
    // 分词失败降级为不高亮，不影响编辑
    spans = []
  }

  if (spanCache.size >= CACHE_LIMIT) {
    // FIFO 淘汰最旧条目，防止长会话内存膨胀
    const oldest = spanCache.keys().next().value
    if (oldest !== undefined) spanCache.delete(oldest)
  }
  spanCache.set(key, spans)
  return spans
}

/** 收集整篇文档的高亮 decorations；inline decoration 的 from/to 基于 doc 绝对位置 */
function buildDecorations(doc: ProseNode): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return true
    const language = String(node.attrs.language ?? '')
    if (!language || language === 'plantuml' || !hljs.getLanguage(language)) return false
    const code = node.textContent
    if (!code) return false
    // textblock 内容从 pos + 1 开始
    const contentStart = pos + 1
    for (const span of getSpans(language, code)) {
      decorations.push(
        Decoration.inline(contentStart + span.from, contentStart + span.to, { class: span.cls })
      )
    }
    return false
  })
  return DecorationSet.create(doc, decorations)
}

export const codeHighlightPlugin = $prose(() => {
  const key = new PluginKey<DecorationSet>('vividmark-code-highlight')
  return new Plugin({
    key,
    state: {
      init: (_config, instance) => buildDecorations(instance.doc),
      apply: (tr, old) => (tr.docChanged ? buildDecorations(tr.doc) : old.map(tr.mapping, tr.doc)),
    },
    props: {
      decorations(state) {
        return key.getState(state)
      },
    },
  })
})
