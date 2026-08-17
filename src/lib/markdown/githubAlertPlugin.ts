import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs'
import { getAdmonitionDisplayTitle } from './admonitionTypes'
import { matchAlertMarkerLine, type GithubAlertType } from './githubAlert'

/**
 * GitHub Alerts（`> [!NOTE]`）的 markdown-it core rule（预览/分栏/导出侧；方案批次 1）。
 *
 * 实现为 blockquote 的 token 后处理而非块级 rule：CommonMark 的引用块语义（`>` 前缀、
 * 惰性续行、嵌套）已由 block parser 正确处理，这里只对已解析的 token 流做识别改写：
 * - 命中：blockquote_open/close 改写为 github_alert_open/close（渲染为 `<div class=
 *   "admonition <type>">` 三段式，与 `:::`/`!!!` 产出口径一致，CSS 零适配），首段中的
 *   标记文本与换行剥离；标记是 blockquote 唯一内容时连空段落一并移除。
 * - 未命中（未知类型/标记非首行/同行跟文本/折叠标记 +/-）：原样保留普通引用块。
 *
 * core rule 放在链尾（push）：此时 inline.children 已完成 linkify/typographer/text_join，
 * 标记 `[!TYPE]` 必为首个 text token 的开头，剥离逻辑得以简单化。
 */

/** 从 inline.children 剥离标记文本与其行尾换行（softbreak/hardbreak） */
function stripAlertMarker(inline: Token): void {
  const children = inline.children ?? []
  const first = children[0]
  if (first?.type === 'text') {
    first.content = first.content.replace(/^\[![A-Za-z]+\][ \t]*/, '')
    if (first.content === '') children.shift()
  }
  if (children[0] && (children[0].type === 'softbreak' || children[0].type === 'hardbreak')) {
    children.shift()
  }
  inline.children = children
}

function githubAlert(state: StateCore): boolean {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i]
    if (open.type !== 'blockquote_open') continue

    // 标记只认「首段首行」：结构须为 blockquote_open, paragraph_open, inline, paragraph_close
    const paraOpen = tokens[i + 1]
    const inline = tokens[i + 2]
    const paraClose = tokens[i + 3]
    if (paraOpen?.type !== 'paragraph_open') continue
    if (inline?.type !== 'inline') continue
    if (paraClose?.type !== 'paragraph_close') continue

    const newlineIdx = inline.content.indexOf('\n')
    const firstLine = newlineIdx === -1 ? inline.content : inline.content.slice(0, newlineIdx)
    const type = matchAlertMarkerLine(firstLine)
    if (!type) continue

    // 配对 close（深度扫描跳过嵌套 blockquote）；引用块必然配对，找不到则保守跳过
    let depth = 0
    let close: Token | null = null
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_open') depth++
      else if (tokens[j].type === 'blockquote_close') {
        if (depth === 0) {
          close = tokens[j]
          break
        }
        depth--
      }
    }
    if (!close) continue

    open.type = 'github_alert_open'
    open.tag = 'div'
    open.meta = { type }
    close.type = 'github_alert_close'
    close.tag = 'div'

    stripAlertMarker(inline)
    if (inline.children?.length === 0) {
      // 标记是 blockquote 唯一内容：连空段落三件套一并移除（close 引用已持有，不受位移影响）
      tokens.splice(i + 1, 3)
    }
  }
  return true
}

export function githubAlertPlugin(md: MarkdownIt): void {
  md.core.ruler.push('github_alert', githubAlert)

  // 与 parser.ts 中 markdown-it-container / bangAdmonitionPlugin 的产出结构保持一致（CSS/测试均锁定该结构）
  md.renderer.rules.github_alert_open = (tokens, idx) => {
    const meta = tokens[idx].meta as { type: GithubAlertType }
    return `<div class="admonition ${meta.type}">
  <div class="admonition-title">${getAdmonitionDisplayTitle(meta.type, '')}</div>
  <div class="admonition-content">`
  }
  md.renderer.rules.github_alert_close = () => '</div></div>\n'
}
