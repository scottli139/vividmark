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
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'list'
  | 'ol'
  | 'tasklist'
  | 'codeblock'
  | 'paragraph'

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
  h4: '#### ',
  h5: '##### ',
  h6: '###### ',
  quote: '> ',
  list: '- ',
  ol: '1. ',
  tasklist: '- [ ] ',
}

/** 行首块级前缀识别：标题 / 引用 / 任务 / 无序 / 有序列表；返回匹配到的前缀长度 */
const BLOCK_PREFIX_RES = [/^#{1,6} /, /^> /, /^- \[[ xX]\] /, /^- /, /^\d+\. /]

function matchBlockPrefix(text: string): { length: number } | null {
  for (const re of BLOCK_PREFIX_RES) {
    const m = text.match(re)
    if (m) return { length: m[0].length }
  }
  return null
}

/** 有序列表的行前缀匹配（编号不固定为 1） */
const OL_PREFIX_RE = /^\d+\. /

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

/**
 * 块级格式化：切换行首前缀（标题/引用/列表/任务列表）。
 * 作用于选区覆盖的所有行：
 * - 所有行都已有该前缀 → 全部移除（toggle off；有序列表按实际编号前缀匹配）
 * - 否则逐行添加；已有其他块级前缀（标题/引用/列表/任务）时替换
 * 选区由 CM 自动随 changes 映射，无需显式指定。
 */
export function toggleBlockFormat(state: EditorState, format: FormatType): TransactionSpec {
  const prefix = BLOCK_PREFIXES[format]
  if (prefix === undefined) {
    throw new Error(`Not a block format: ${format}`)
  }

  const lines = selectedLines(state)

  // ol 按实际编号匹配；list 不把任务项（- [ ] / - [x]）当作普通无序项，
  // 否则对任务项 toggle list 只会剥掉 '- ' 留下 '[ ] ' 残渣
  const hasPrefix = (text: string) => {
    if (format === 'ol') return OL_PREFIX_RE.test(text)
    if (format === 'list') return /^- (?!\[[ xX]\] )/.test(text)
    return text.startsWith(prefix)
  }
  const allHavePrefix = lines.every((line) => hasPrefix(line.text))

  const changes = []
  for (const line of lines) {
    const text = line.text
    if (allHavePrefix) {
      // 全部已有前缀：统一移除（ol 移除实际编号前缀）
      const removeLen =
        format === 'ol' ? (text.match(OL_PREFIX_RE)?.[0].length ?? 0) : prefix.length
      if (removeLen > 0) {
        changes.push({ from: line.from, to: line.from + removeLen, insert: '' })
      }
      continue
    }
    if (hasPrefix(text)) continue

    const existing = matchBlockPrefix(text)
    if (existing) {
      // 替换其他块级前缀（标题/引用/无序/有序/任务列表）
      changes.push({ from: line.from, to: line.from + existing.length, insert: prefix })
    } else {
      changes.push({ from: line.from, insert: prefix })
    }
  }

  if (changes.length === 0) return {}

  return { changes, scrollIntoView: true, userEvent: 'input' }
}

/**
 * 正文（段落）：剥掉选区所有行的行首块级前缀（标题/引用/列表/任务），
 * 无前缀的行保持不变。对应 Typora 段落菜单的「正文」。
 */
export function applyParagraphFormat(state: EditorState): TransactionSpec {
  const changes = []
  for (const line of selectedLines(state)) {
    const existing = matchBlockPrefix(line.text)
    if (existing) {
      changes.push({ from: line.from, to: line.from + existing.length, insert: '' })
    }
  }
  if (changes.length === 0) return {}
  return { changes, scrollIntoView: true, userEvent: 'input' }
}

/** 选区覆盖的行集合；选区恰好结束于下一行行首时，不包含该空行 */
function selectedLines(state: EditorState) {
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  let endLine = state.doc.lineAt(to)
  if (to > from && to === endLine.from && endLine.number > startLine.number) {
    endLine = state.doc.line(endLine.number - 1)
  }

  const lines = []
  for (let n = startLine.number; n <= endLine.number; n++) {
    lines.push(state.doc.line(n))
  }
  return lines
}

/**
 * 根据格式类型分发到行内/块级变换（paragraph 走前缀剥离）
 */
export function formatTransaction(state: EditorState, format: FormatType): TransactionSpec {
  if (format === 'paragraph') return applyParagraphFormat(state)
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
