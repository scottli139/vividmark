import { useCallback } from 'react'

export type FormatType =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'quote'
  | 'list'
  | 'codeblock'

interface FormatConfig {
  prefix: string
  suffix: string
  placeholder?: string
}

const FORMAT_CONFIGS: Record<FormatType, FormatConfig> = {
  bold: { prefix: '**', suffix: '**', placeholder: 'bold text' },
  italic: { prefix: '*', suffix: '*', placeholder: 'italic text' },
  strike: { prefix: '~~', suffix: '~~', placeholder: 'strikethrough' },
  code: { prefix: '`', suffix: '`', placeholder: 'code' },
  link: { prefix: '[', suffix: '](url)', placeholder: 'link text' },
  h1: { prefix: '# ', suffix: '' },
  h2: { prefix: '## ', suffix: '' },
  h3: { prefix: '### ', suffix: '' },
  quote: { prefix: '> ', suffix: '' },
  list: { prefix: '- ', suffix: '' },
  codeblock: { prefix: '```\n', suffix: '\n```', placeholder: 'code here' },
}

/**
 * 格式化文本的 Hook
 *
 * 提供各种 Markdown 格式化功能
 */
export function useTextFormat() {
  const formatText = useCallback(
    (text: string, format: FormatType, selection?: { start: number; end: number }) => {
      const config = FORMAT_CONFIGS[format]
      const placeholder = config.placeholder || 'text'

      if (selection && selection.start !== selection.end) {
        // 有选中文字，包裹选中内容
        const before = text.slice(0, selection.start)
        const selected = text.slice(selection.start, selection.end)
        const after = text.slice(selection.end)
        const newText = before + config.prefix + selected + config.suffix + after
        const newCursorPos =
          selection.start + config.prefix.length + selected.length + config.suffix.length
        return { text: newText, cursorPos: newCursorPos }
      } else {
        // 没有选中文字，插入占位符
        const insertPos = selection?.start ?? text.length
        const before = text.slice(0, insertPos)
        const after = text.slice(insertPos)
        const newText = before + config.prefix + placeholder + config.suffix + after
        const newCursorPos = insertPos + config.prefix.length
        return { text: newText, cursorPos: newCursorPos, selectLength: placeholder.length }
      }
    },
    []
  )

  const toggleBlockPrefix = useCallback(
    (text: string, format: 'h1' | 'h2' | 'h3' | 'quote' | 'list') => {
      const config = FORMAT_CONFIGS[format]
      const lines = text.split('\n')
      const firstLine = lines[0]

      // 检查是否已经有该前缀
      if (firstLine.startsWith(config.prefix)) {
        // 移除前缀
        lines[0] = firstLine.slice(config.prefix.length)
        return lines.join('\n')
      }

      // 检查是否需要移除其他标题前缀
      const headingPrefixes = ['# ', '## ', '### ']
      for (const prefix of headingPrefixes) {
        if (firstLine.startsWith(prefix) && config.prefix !== prefix) {
          lines[0] = config.prefix + firstLine.slice(prefix.length)
          return lines.join('\n')
        }
      }

      // 检查是否需要移除引用或列表前缀
      if (firstLine.startsWith('> ') || firstLine.startsWith('- ')) {
        lines[0] = config.prefix + firstLine.slice(2)
        return lines.join('\n')
      }

      // 添加前缀
      lines[0] = config.prefix + firstLine
      return lines.join('\n')
    },
    []
  )

  return { formatText, toggleBlockPrefix }
}
