import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs'
import { getAdmonitionDisplayTitle } from './admonitionTypes'
import { admonitionDisplayClass } from './bangAdmonition'

interface CollapsibleMarker {
  type: string
  title: string
}

const COLLAPSIBLE_MARKER_RE =
  /^ {0,3}\?\?\?\s*([a-zA-Z][\w-]*)\s*(?:"([^"]*)"|'([^']*)'|(\S.*?))?\s*$/

function parseCollapsibleMarker(line: string): CollapsibleMarker | null {
  const match = line.match(COLLAPSIBLE_MARKER_RE)
  if (!match) return null

  return {
    type: match[1].toLowerCase(),
    title: (match[2] ?? match[3] ?? match[4] ?? '').trim(),
  }
}

function collapsibleAdmonition(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean
): boolean {
  const startPos = state.bMarks[startLine] + state.tShift[startLine]
  const marker = parseCollapsibleMarker(state.src.slice(startPos, state.eMarks[startLine]))
  if (!marker) return false
  if (silent) return true

  // Match the MkDocs `!!!` boundary: blank lines are included only when
  // followed by another indented content line.
  let lastLine = startLine
  for (let nextLine = startLine + 1; nextLine < endLine; nextLine++) {
    if (state.isEmpty(nextLine)) continue
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      lastLine = nextLine
      continue
    }
    break
  }

  const openToken = state.push('admonition_collapsible_open', 'details', 1)
  openToken.markup = '???'
  openToken.meta = { type: marker.type, title: marker.title }
  openToken.map = [startLine, lastLine + 1]

  if (lastLine > startLine) {
    const innerLines: string[] = []
    for (let line = startLine + 1; line <= lastLine; line++) {
      const text = state.src.slice(state.bMarks[line], state.eMarks[line])
      innerLines.push(text.startsWith('\t') ? text.slice(1) : text.replace(/^ {4}/, ''))
    }
    const innerTokens: Token[] = []
    state.md.block.parse(innerLines.join('\n'), state.md, state.env, innerTokens)
    for (const token of innerTokens) state.tokens.push(token)
  }

  const closeToken = state.push('admonition_collapsible_close', 'details', -1)
  closeToken.markup = '???'

  state.line = lastLine + 1
  return true
}

/** Render MkDocs `???` blocks as native, initially collapsed HTML details. */
export function collapsibleAdmonitionPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'admonition_collapsible', collapsibleAdmonition, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })

  md.renderer.rules.admonition_collapsible_open = (tokens, idx) => {
    const meta = tokens[idx].meta as CollapsibleMarker
    const title = getAdmonitionDisplayTitle(meta.type, meta.title)
    return `<details class="admonition ${admonitionDisplayClass(meta.type)}">
  <summary class="admonition-title">${md.utils.escapeHtml(title)}</summary>
  <div class="admonition-content">`
  }
  md.renderer.rules.admonition_collapsible_close = () => '</div></details>\n'
}
