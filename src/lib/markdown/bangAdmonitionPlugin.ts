import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import { getAdmonitionDisplayTitle } from './admonitionTypes'
import { admonitionDisplayClass, parseBangMarker } from './bangAdmonition'

/**
 * MkDocs `!!!` admonition 的 markdown-it 块级 rule（预览/分栏侧；方案 P2.1）。
 *
 * 不能复用 markdown-it-container：`!!!` 无结束围栏，内容范围由「后续 4 空格/tab
 * 缩进的行」决定（空行悬挂：空行后仍是缩进行则归属容器）。规则命中后收集缩进内容、
 * dedent 一级，再用完整块级解析递归——嵌套 `!!!`、容器内围栏代码块、引用块等
 * 都由标准块级机制正确处理。
 *
 * 产出 HTML 复用现有 `<div class="admonition">` 结构与 CSS（视觉零成本）；
 * 未知类型（mkdocs 扩展类型 abstract/question/...）显示降级 note 主题，
 * 默认标题仍取原类型名（对齐 Python-Markdown）。
 */

function admonitionBang(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine]
  const marker = parseBangMarker(state.src.slice(startPos, state.eMarks[startLine]))
  if (!marker) return false
  if (silent) return true

  // 内容范围：空行或相对缩进 ≥4 的行；尾部空行不属于容器
  let lastLine = startLine
  for (let nextLine = startLine + 1; nextLine < endLine; nextLine++) {
    if (state.isEmpty(nextLine)) continue
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      lastLine = nextLine
      continue
    }
    break
  }

  const openToken = state.push('admonition_bang_open', 'div', 1)
  openToken.markup = '!!!'
  openToken.meta = { type: marker.type, title: marker.title }
  openToken.map = [startLine, lastLine + 1]

  if (lastLine > startLine) {
    // dedent 一级（4 空格或 1 tab）后完整块级解析递归
    const innerLines: string[] = []
    for (let l = startLine + 1; l <= lastLine; l++) {
      const text = state.src.slice(state.bMarks[l], state.eMarks[l])
      innerLines.push(text.startsWith('\t') ? text.slice(1) : text.replace(/^ {4}/, ''))
    }
    const innerTokens: Token[] = []
    state.md.block.parse(innerLines.join('\n'), state.md, state.env, innerTokens)
    for (const token of innerTokens) state.tokens.push(token)
  }

  const closeToken = state.push('admonition_bang_close', 'div', -1)
  closeToken.markup = '!!!'

  state.line = lastLine + 1
  return true
}

/** 与 parser.ts 中 markdown-it-container 的 render 产出结构保持一致（CSS/测试均锁定该结构） */
export function bangAdmonitionPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'admonition_bang', admonitionBang, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })

  md.renderer.rules.admonition_bang_open = (tokens, idx) => {
    const meta = tokens[idx].meta as { type: string; title: string }
    const title = getAdmonitionDisplayTitle(meta.type, meta.title)
    return `<div class="admonition ${admonitionDisplayClass(meta.type)}">
  <div class="admonition-title">${title}</div>
  <div class="admonition-content">`
  }
  md.renderer.rules.admonition_bang_close = () => '</div></div>\n'
}
