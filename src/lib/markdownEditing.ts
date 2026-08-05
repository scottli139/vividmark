/**
 * Markdown 编辑操作（CodeMirror 6）
 *
 * 纯函数库：接收 EditorState，返回 TransactionSpec，不依赖 EditorView，
 * 便于在 jsdom 中直接单测。工具栏的 editor-format 事件与格式快捷键
 * （Mod-B/I/K/1/2/3）都走这里的同一套变换逻辑。
 */

import type { EditorState, TransactionSpec } from '@codemirror/state'

export type FormatType =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | 'image'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'list'
  | 'tasklist'
  | 'codeblock'

interface InlineFormatConfig {
  prefix: string
  suffix: string
  placeholder?: string
}

const INLINE_FORMAT_CONFIGS: Partial<Record<FormatType, InlineFormatConfig>> = {
  bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
  italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
  strike: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough' },
  code: { prefix: '`', suffix: '`', placeholder: 'code' },
  link: { prefix: '[', suffix: '](url)', placeholder: 'link text' },
  image: { prefix: '![', suffix: '](image-url)', placeholder: 'alt text' },
  codeblock: { prefix: '```\n', suffix: '\n```', placeholder: 'code here' },
}

const BLOCK_PREFIXES: Partial<Record<FormatType, string>> = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  quote: '> ',
  list: '- ',
  tasklist: '- [ ] ',
}

export function isBlockFormat(format: FormatType): boolean {
  return format in BLOCK_PREFIXES
}

/**
 * 行内格式化：包裹选区（`**bold**`），无选区时插入占位符并选中占位词。
 * 与原 useTextFormat.formatText 行为一致。
 */
export function applyInlineFormat(state: EditorState, format: FormatType): TransactionSpec {
  const config = INLINE_FORMAT_CONFIGS[format]
  if (!config) {
    throw new Error(`Not an inline format: ${format}`)
  }

  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)

  if (selected.length > 0) {
    // 有选中文字：包裹选中内容，光标移到格式化文本之后
    const insert = config.prefix + selected + config.suffix
    return {
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      scrollIntoView: true,
      userEvent: 'input',
    }
  }

  // 无选中文字：插入占位符并选中占位词
  const placeholder = config.placeholder ?? 'text'
  const insert = config.prefix + placeholder + config.suffix
  const anchor = from + config.prefix.length
  return {
    changes: { from, insert },
    selection: { anchor, head: anchor + placeholder.length },
    scrollIntoView: true,
    userEvent: 'input',
  }
}

const HEADING_PREFIX_RE = /^#{1,6} /

/**
 * 块级格式化：切换行首前缀（标题/引用/列表/任务列表）。
 * 作用于选区覆盖的所有行：
 * - 所有行都已有该前缀 → 全部移除（toggle off）
 * - 否则逐行添加；已有其他标题前缀或 `> `/`- ` 前缀时替换
 * 选区由 CM 自动随 changes 映射，无需显式指定。
 */
export function toggleBlockFormat(state: EditorState, format: FormatType): TransactionSpec {
  const prefix = BLOCK_PREFIXES[format]
  if (prefix === undefined) {
    throw new Error(`Not a block format: ${format}`)
  }

  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  let endLine = state.doc.lineAt(to)
  // 选区恰好结束于下一行行首时，不处理该空行
  if (to > from && to === endLine.from && endLine.number > startLine.number) {
    endLine = state.doc.line(endLine.number - 1)
  }

  const lines = []
  for (let n = startLine.number; n <= endLine.number; n++) {
    lines.push(state.doc.line(n))
  }

  const allHavePrefix = lines.every((line) => line.text.startsWith(prefix))

  const changes = []
  for (const line of lines) {
    const text = line.text
    if (allHavePrefix) {
      // 全部已有前缀：统一移除
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
      continue
    }
    if (text.startsWith(prefix)) continue

    const headingMatch = text.match(HEADING_PREFIX_RE)
    if (headingMatch) {
      // 替换其他标题前缀
      changes.push({ from: line.from, to: line.from + headingMatch[0].length, insert: prefix })
    } else if (text.startsWith('> ') || text.startsWith('- ')) {
      // 替换引用/列表前缀
      changes.push({ from: line.from, to: line.from + 2, insert: prefix })
    } else {
      changes.push({ from: line.from, insert: prefix })
    }
  }

  if (changes.length === 0) return {}

  return { changes, scrollIntoView: true, userEvent: 'input' }
}

/**
 * 根据格式类型分发到行内/块级变换
 */
export function formatTransaction(state: EditorState, format: FormatType): TransactionSpec {
  return isBlockFormat(format) ? toggleBlockFormat(state, format) : applyInlineFormat(state, format)
}

/**
 * 在光标处插入文本（替换选区），光标落到插入文本之后。
 * 对应原 editor-insert 事件在 textarea 中的行为。
 */
export function insertTextAtCursor(state: EditorState, text: string): TransactionSpec {
  const { from, to } = state.selection.main
  return {
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
    userEvent: 'input',
  }
}
