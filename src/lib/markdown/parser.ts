import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

// 创建 markdown-it 实例，集成代码高亮
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight: function (str: string, lang: string) {
    // 如果指定了语言且支持，使用该语言高亮
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // 忽略错误，使用自动检测
      }
    }
    // 自动检测语言
    try {
      return `<pre class="hljs"><code>${hljs.highlightAuto(str).value}</code></pre>`
    } catch {
      // 如果高亮失败，返回转义后的原始代码
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
    }
  },
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
