import type MarkdownIt from 'markdown-it'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs'
import katex from 'katex'

/**
 * KaTeX 数学公式 markdown-it 支持（自写规则，无第三方 mdit 插件依赖）
 *
 * 语法规则与 WYSIWYG 侧（remark-math / micromark-extension-math 3.x）严格对齐，
 * 保证 WYSIWYG ⇄ Source 切换不抖动：
 *
 * - 块级（display）：仅多行围栏形式 `$$` 行 + 内容行 + `$$` 行。
 *   opening fence 同行的 meta 不能含 `$`（因此单行 `$$x$$` 不会被块级规则吃掉，
 *   降级为段落后由行内规则解析为 size-2 行内公式——与 micromark 行为一致）。
 *   closing fence 行尾只允许空白；无 closing fence 时内容延伸至文末（同 fenced code）。
 * - 行内：`$...$`（也支持 `$$...$$`，fence 长度任意但必须前后一致）。
 *   opening `$` 的前一个字符不能是未转义的 `$`（micromark previous 规则）；
 *   内容可含空格/软换行；长度不符的 `$` 串视为内容继续扫描。
 *   注意 micromark mathText 无 pandoc 货币保护（`$5 and $10` 会被解析），本规则同样如此。
 *
 * 渲染：`katex.renderToString`，`throwOnError: false`（错误公式显示红色提示而非炸渲染）。
 */

const DOLLAR = 0x24 // $
const BACKSLASH = 0x5c // \

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false })
  } catch {
    // throwOnError:false 下不应到达，兜底转义原文
    return `<code>${tex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`
  }
}

// ==================== 块级规则（$$ 多行围栏） ====================

function mathBlock(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine]
  const maxPos = state.eMarks[startLine]

  // 缩进 ≥ 4 视为代码块（与 fence 规则一致）
  if (state.sCount[startLine] - state.blkIndent >= 4) return false

  if (state.src.charCodeAt(startPos) !== DOLLAR || state.src.charCodeAt(startPos + 1) !== DOLLAR) {
    return false
  }

  // opening fence 长度（≥ 2）
  let pos = startPos
  while (state.src.charCodeAt(pos) === DOLLAR) pos++
  const sizeOpen = pos - startPos

  // meta（fence 后同行剩余）不能含 `$`——含则整体不匹配，
  // 单行 `$$x$$` 由此降级为段落，交给行内规则（对齐 micromark mathFlow meta 规则）
  if (state.src.slice(pos, maxPos).includes('$')) return false

  if (silent) return true

  // 逐行找 closing fence：行首（缩进 <4）`$` run 长度 ≥ sizeOpen，行尾仅空白
  let nextLine = startLine + 1
  let haveClosing = false
  for (; nextLine < endLine; nextLine++) {
    const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
    if (state.sCount[nextLine] - state.blkIndent >= 4) continue
    if (state.src.charCodeAt(lineStart) !== DOLLAR) continue

    let p = lineStart
    while (state.src.charCodeAt(p) === DOLLAR) p++
    if (p - lineStart < sizeOpen) continue
    if (state.src.slice(p, state.eMarks[nextLine]).trim().length > 0) continue

    haveClosing = true
    break
  }

  const content = state.getLines(startLine + 1, nextLine, state.blkIndent, false)
  state.line = haveClosing ? nextLine + 1 : nextLine

  const token = state.push('math_block', '', 0)
  token.content = content
  token.markup = state.src.slice(startPos, pos)
  token.map = [startLine, state.line]
  return true
}

// ==================== 行内规则（$...$ / $$...$$） ====================

function mathInline(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  const src = state.src

  if (src.charCodeAt(start) !== DOLLAR) return false

  // 前一个字符是 `$` 时不开启（`$$x$` 中的第二个 `$`）；
  // 例外是 `\$` 转义后的 `$`（对齐 micromark previous 规则：转义符后的 $ 可开启）
  if (start > 0 && src.charCodeAt(start - 1) === DOLLAR) {
    if (!(start > 1 && src.charCodeAt(start - 2) === BACKSLASH)) return false
  }

  // opening fence 长度（≥ 1）
  let pos = start
  while (src.charCodeAt(pos) === DOLLAR) pos++
  const sizeOpen = pos - start

  // 扫描 closing：长度恰好等于 sizeOpen 的 `$` run；长度不符的 run 视为内容
  let closePos = -1
  let i = pos
  while (i < state.posMax) {
    if (src.charCodeAt(i) === DOLLAR) {
      let j = i
      while (src.charCodeAt(j) === DOLLAR) j++
      if (j - i === sizeOpen) {
        closePos = i
        break
      }
      i = j
      continue
    }
    i++
  }
  if (closePos === -1) return false

  if (!silent) {
    const token = state.push('math_inline', '', 0)
    token.content = src.slice(pos, closePos)
    token.markup = '$'.repeat(sizeOpen)
  }
  state.pos = closePos + sizeOpen
  return true
}

// ==================== 插件注册 ====================

export function mathPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })
  md.inline.ruler.after('escape', 'math_inline', mathInline)

  md.renderer.rules.math_block = (tokens, idx) => {
    const content = tokens[idx].content.trim()
    return `<div class="math-block">${renderKatex(content, true)}</div>\n`
  }

  md.renderer.rules.math_inline = (tokens, idx) => {
    return `<span class="math-inline">${renderKatex(tokens[idx].content, false)}</span>`
  }
}
