import MarkdownIt from 'markdown-it'

// 创建 markdown-it 实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
})

// 解析 Markdown 为 HTML
export function parseMarkdown(content: string): string {
  return md.render(content)
}

// 获取纯文本摘要
export function getExcerpt(content: string, maxLength: number = 100): string {
  const plainText = content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n/g, ' ')
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }
  return plainText.slice(0, maxLength) + '...'
}

// 导出 markdown-it 实例以便扩展
export { md }
