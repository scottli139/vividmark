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

  lines.forEach((line, lineIndex) => {
    if (line.startsWith('#')) {
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
 * 计算指定字符位置在 textarea 中的行高（用于滚动）
 * @param content 完整内容
 * @param charIndex 字符位置
 * @param lineHeight 每行高度（像素）
 * @returns 滚动位置（像素）
 */
export function calculateScrollPosition(
  content: string,
  charIndex: number,
  lineHeight: number = 24
): number {
  const lines = content.slice(0, charIndex).split('\n')
  return (lines.length - 1) * lineHeight
}

/**
 * 查找最接近指定字符位置的行起始位置
 * @param content 完整内容
 * @param charIndex 字符位置
 * @returns 行起始字符位置
 */
export function findLineStart(content: string, charIndex: number): number {
  const lastNewline = content.lastIndexOf('\n', charIndex)
  return lastNewline === -1 ? 0 : lastNewline + 1
}

/**
 * 将光标滚动到可视区域
 * @param textarea textarea 元素
 * @param charIndex 字符位置
 * @param lineHeight 行高
 */
export function scrollToPosition(
  textarea: HTMLTextAreaElement,
  charIndex: number,
  lineHeight: number = 24
): void {
  const content = textarea.value
  const scrollPos = calculateScrollPosition(content, charIndex, lineHeight)

  // 添加一些上边距，让目标位置不在最顶部
  const padding = lineHeight * 3
  const targetScrollTop = Math.max(0, scrollPos - padding)

  textarea.scrollTo({
    top: targetScrollTop,
    behavior: 'smooth',
  })

  // 设置光标位置
  textarea.setSelectionRange(charIndex, charIndex)
  textarea.focus()
}

/**
 * 滚动预览区域到指定标题
 * @param container 预览容器元素
 * @param headingIndex 标题索引（第几个 h1/h2/h3 等）
 */
export function scrollPreviewToHeading(
  container: HTMLElement,
  headingIndex: number
): void {
  // 查找所有标题元素 (h1, h2, h3, h4, h5, h6)
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')

  if (headingIndex >= 0 && headingIndex < headings.length) {
    const targetHeading = headings[headingIndex] as HTMLElement

    // 添加一些上边距
    const padding = 60
    const targetScrollTop = Math.max(
      0,
      targetHeading.offsetTop - container.offsetTop - padding
    )

    container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth',
    })
  }
}
