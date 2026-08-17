/**
 * MkDocs `!!!` admonition（Python-Markdown 风格）双端支持的共享纯函数。
 *
 * 与 `:::` 容器的关键差异：`!!!` 无结束围栏，内容范围由「后续 4 空格（或 tab）缩进
 * 的行」决定；空行悬挂——空行之后仍是缩进行则归属容器，否则容器在空行前结束。
 *
 * 两个消费方：
 * 1. 预览/分栏（bangAdmonitionPlugin.ts）：markdown-it 自写块级 rule 直接渲染
 *    （不能复用 markdown-it-container：它靠成对围栏定界）。
 * 2. WYSIWYG：文本级预处理 preprocessBangAdmonitions 把 `!!!` 缩进块转成内部
 *    `:::!` 形式（bang 来源编码），交给现有 admonition remark 变换（PM 节点带
 *    syntax: 'bang' attr）；序列化按 attr 还原 `!!!` + 4 空格缩进，保证 mkdocs
 *    文档「!!! 进、!!! 出」——若归一成 `:::` 写回会弄坏用户的 mkdocs 构建
 *    （Python-Markdown 只认 `!!!`）。
 *
 * 解析侧为何是文本预处理而非 remark 变换：缩进信息到 mdast 层已被抹掉
 * （`!!! note\n    内容\n\n    第二段` 经 commonmark 变成「标记行融合段落 +
 * 缩进代码块兄弟节点」），多段内容归属无法从 mdast 可靠复原。
 */

import { isAdmonitionType } from './admonitionTypes'

/** 内部形式起始标记前缀：`:::! note`（仅存在于 Milkdown 解析前的瞬态文本，不落盘） */
export const BANG_INTERNAL_PREFIX = ':::!'

/**
 * 标记行：至多 3 空格缩进 + `!!!` + 类型名 + 可选标题。
 * 标题三种形态：双引号 / 单引号 / 无引号原文（Python-Markdown 均接受）；
 * `!!!!`、`!!!123`（类型非字母开头）不匹配。
 */
const BANG_MARKER_RE = /^ {0,3}!!!\s*([a-zA-Z][\w-]*)\s*(?:"([^"]*)"|'([^']*)'|(\S.*?))?\s*$/

/** 代码围栏行（``` 或 ~~~）：预处理扫描跳过其内部，避免误转换代码示例中的 `!!!` 文本 */
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/

/**
 * `:::` 容器行：其内部不转换 bang——现有 mdast 变换按「最近结束围栏」配对 colon
 * 容器，内部混入 bang 对会错乱；保持原文降级（不丢失、不渲染成框）。
 */
const COLON_CONTAINER_RE = /^ {0,3}:::/

export interface BangMarker {
  /** 小写类型名（未知类型原样保留，显示层降级 note，序列化不丢） */
  type: string
  /** 标题（已剥引号；空串 = 无自定义标题，显示层回退为类型名首字母大写） */
  title: string
}

/** 解析 `!!!` 标记行；不匹配返回 null。类型名小写化（对齐 Python-Markdown） */
export function parseBangMarker(line: string): BangMarker | null {
  const m = line.match(BANG_MARKER_RE)
  if (!m) return null
  const title = (m[2] ?? m[3] ?? m[4] ?? '').trim()
  return { type: m[1].toLowerCase(), title }
}

/** 展示用 admonition class：已知类型原样，未知类型（mkdocs 扩展类型）降级 note 主题 */
export function admonitionDisplayClass(type: string): string {
  return isAdmonitionType(type) ? type : 'note'
}

function isIndentedContentLine(line: string): boolean {
  return line.startsWith('    ') || line.startsWith('\t')
}

/** dedent 一级：tab 优先，否则去掉前 4 个空格（Python-Markdown block processor 同款） */
function dedentOneLevel(line: string): string {
  if (line.startsWith('\t')) return line.slice(1)
  return line.replace(/^ {4}/, '')
}

/** 递归转换行数组（递归处理嵌套 bang：dedent 后内层 `!!!` 回到行首被再次识别） */
function convertLines(lines: string[]): string[] {
  const out: string[] = []
  let fence: { char: string; len: number } | null = null
  let inColonContainer = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // `:::` 容器内部整体透传（见 COLON_CONTAINER_RE 注释）
    if (inColonContainer) {
      out.push(line)
      if (COLON_CONTAINER_RE.test(line)) inColonContainer = false
      i++
      continue
    }

    // 围栏代码块内部整体透传
    if (fence !== null) {
      out.push(line)
      const closeRe = new RegExp(`^ {0,3}${fence.char}{${fence.len},}[ \\t]*$`)
      if (closeRe.test(line)) fence = null
      i++
      continue
    }
    const fenceMatch = line.match(FENCE_OPEN_RE)
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], len: fenceMatch[1].length }
      out.push(line)
      i++
      continue
    }
    if (COLON_CONTAINER_RE.test(line)) {
      inColonContainer = true
      out.push(line)
      i++
      continue
    }

    const marker = parseBangMarker(line)
    if (!marker) {
      out.push(line)
      i++
      continue
    }

    // 收集内容行：空行或 ≥4 空格/tab 缩进；尾部空行不属于容器
    const content: string[] = []
    let j = i + 1
    while (j < lines.length) {
      const l = lines[j]
      if (l.trim() === '' || isIndentedContentLine(l)) {
        content.push(l)
        j++
      } else {
        break
      }
    }
    while (content.length > 0 && content[content.length - 1].trim() === '') content.pop()

    // 内容含 `:::` 容器标记则不转换（配对机制不支持 colon 嵌入 bang，防 `:::!` 泄漏改写源码）
    const dedented = content.map(dedentOneLevel)
    if (dedented.some((l) => COLON_CONTAINER_RE.test(l))) {
      out.push(line)
      i++
      continue
    }

    out.push(`${BANG_INTERNAL_PREFIX} ${marker.type}${marker.title ? ` ${marker.title}` : ''}`)
    out.push(...convertLines(dedented))
    out.push(':::')
    i = j
  }

  return out
}

/**
 * WYSIWYG 解析前的文本预处理：`!!!` 缩进块 → 内部 `:::!` 形式。
 * 挂在 Milkdown 两个 markdown 入口之前（defaultValueCtx / replaceAll，见 WysiwygEditor）。
 * 已知边界：`!!!` 位于引用/列表内（行首有 `>` / 列表标记）不转换——保持原文降级，
 * 不丢失不损坏；预览侧由 markdown-it 块级 rule 正常渲染。
 */
export function preprocessBangAdmonitions(markdown: string): string {
  if (!markdown.includes('!!!')) return markdown
  return convertLines(markdown.split('\n')).join('\n')
}
