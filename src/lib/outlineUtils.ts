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

/** 大纲树节点：在 OutlineItem 基础上挂载子级 */
export interface OutlineNode extends OutlineItem {
  children: OutlineNode[]
}

/**
 * 把平铺的大纲项按 level 构建为层级树：
 * 同级连续项归为一组，深层项嵌进最近的上级（栈顶即父级候选）
 */
export function buildOutlineTree(items: OutlineItem[]): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: OutlineNode[] = []

  for (const item of items) {
    const node: OutlineNode = { ...item, children: [] }
    // 弹出所有 level >= 当前项的节点，剩下的栈顶就是最近的上级
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop()
    }
    if (stack.length === 0) {
      roots.push(node)
    } else {
      stack[stack.length - 1].children.push(node)
    }
    stack.push(node)
  }

  return roots
}

/**
 * 计算光标当前所属的大纲项：最后一个满足 lineIndex + 1 <= cursorLine 的标题
 * @param headings 平铺大纲项（按文档顺序）
 * @param cursorLine 光标行号（1-based）
 * @returns 命中的大纲项；光标在第一个标题之前或无标题时返回 null
 */
export function findActiveOutlineItem(
  headings: OutlineItem[],
  cursorLine: number
): OutlineItem | null {
  let active: OutlineItem | null = null
  for (const heading of headings) {
    if (heading.lineIndex + 1 > cursorLine) break
    active = heading
  }
  return active
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
