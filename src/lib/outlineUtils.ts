/**
 * 大纲工具函数 - 提取大纲并支持点击跳转
 */

export interface OutlineItem {
  level: number
  text: string
  lineIndex: number
  charIndex: number
  index: number // 用于 preview 模式定位
}

/**
 * 从 Markdown 内容中提取大纲
 * @param content Markdown 内容
 * @returns 大纲项数组，包含层级、文本、行号、字符位置和索引
 */
export function extractOutline(content: string): OutlineItem[] {
  const lines = content.split('\n')
  const headings: OutlineItem[] = []
  let charIndex = 0
  let headingIndex = 0
  // 围栏代码块状态（``` 或 ~~~），代码块内的 # 行不是标题
  let inCodeBlock = false
  let fenceChar = ''

  lines.forEach((line, lineIndex) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (!inCodeBlock) {
        inCodeBlock = true
        fenceChar = marker
      } else if (marker === fenceChar) {
        inCodeBlock = false
      }
    } else if (!inCodeBlock && line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1
      const text = line.replace(/^#+\s*/, '')
      headings.push({
        level,
        text,
        lineIndex,
        charIndex,
        index: headingIndex++,
      })
    }
    charIndex += line.length + 1 // +1 for newline character
  })

  return headings
}

/**
 * 滚动预览区域到指定标题
 * @param container 预览容器元素
 * @param headingIndex 标题索引（第几个 h1/h2/h3 等）
 */
export function scrollPreviewToHeading(container: HTMLElement, headingIndex: number): void {
  // 查找所有标题元素 (h1, h2, h3, h4, h5, h6)
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')

  if (headingIndex >= 0 && headingIndex < headings.length) {
    const targetHeading = headings[headingIndex] as HTMLElement

    // 添加一些上边距
    const padding = 60
    const targetScrollTop = Math.max(0, targetHeading.offsetTop - container.offsetTop - padding)

    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    })
  }
}
