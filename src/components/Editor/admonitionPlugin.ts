import { $nodeSchema, $remark } from '@milkdown/kit/utils'
import { isAdmonitionType } from '../../lib/markdown/admonitionTypes'

/**
 * Admonition Milkdown 支持：`::: tip` 容器（colon，应用原生语法）+ mkdocs `!!!`
 * 容器（bang，经 preprocessBangAdmonitions 文本预处理转成内部 `:::!` 形式进入）。
 *
 * 三部分：
 * 1. remark 变换（remarkAdmonition）：线性扫描 mdast，把 `::: type 可选标题` 起始段落
 *    与 `:::` 结束段落之间的块收集为 admonition 节点；未闭合则保持普通段落降级。
 *    选择自写 mdast 变换而非 remark-directive：后者只认 `:::tip`（名字紧跟冒号），
 *    与 VividMark 现有 `::: tip`（带空格，markdown-it-container 风格）语法不兼容。
 * 2. mdast-util-to-markdown handler（admonitionToMarkdown）：按 syntax attr 序列化——
 *    colon 回 `:::` 围栏；bang 回 `!!! type "title"` + 内容 4 空格缩进（语法保持往返，
 *    不归一化改写用户的 mkdocs 源码），经 unified data('toMarkdownExtensions') 注册。
 * 3. $nodeSchema：PM 节点定义 + parseMarkdown/toMarkdown 双向 runner。
 */

// ==================== mdast 最小类型（避免新增 unified/mdast 直接依赖） ====================

interface MdastFlowNode {
  type: string
  children?: MdastFlowNode[]
  value?: unknown
  data?: unknown
  admonitionType?: unknown
  title?: unknown
  /** 围栏形态：'colon' = `:::`（默认）；'bang' = mkdocs `!!!`（内部 `:::!` 形式识别而来） */
  syntax?: unknown
}

interface ToMarkdownTracker {
  move: (value: string) => string
  current: () => unknown
}

interface ToMarkdownState {
  enter: (name: string) => () => void
  createTracker: (info: unknown) => ToMarkdownTracker
  containerFlow: (node: MdastFlowNode, info: unknown) => string
}

/** unified Processor 的最小结构（this 上下文只用到 data()） */
interface RemarkProcessorHost {
  data: () => { toMarkdownExtensions?: unknown[] }
}

// ==================== 1. mdast 变换 ====================

/**
 * 起始围栏：`::: tip` / `::: tip 自定义标题`（colon；类型名大小写敏感，
 * 与 markdown-it-container 一致）。`:::! tip` 为 bang（mkdocs `!!!`）内部形式——
 * 由 preprocessBangAdmonitions 生成（仅 Milkdown 解析前的瞬态文本，不落盘），
 * 识别后 syntax 置 'bang'，序列化还原 `!!!`。类型名放宽到 [\w-]（mkdocs 扩展类型）。
 */
const START_MARKER = /^:::(!)?\s*([a-z][\w-]*)\s*(.*?)\s*$/
/** 结束围栏：独立的 `:::` 行 */
const END_MARKER = /^:::\s*$/

interface AdmonitionMarker {
  bang: boolean
  type: string
  title: string
}

function parseStartMarker(text: string): AdmonitionMarker | null {
  const m = text.match(START_MARKER)
  if (!m) return null
  return { bang: m[1] === '!', type: m[2], title: m[3] ?? '' }
}

function isTextNode(node: MdastFlowNode): boolean {
  return node.type === 'text' && typeof node.value === 'string'
}

/** 仅当段落是纯文本（无行内格式）时才可能是围栏标记；含行内标记的标题按普通段落降级 */
function getMarkerText(node: MdastFlowNode): string | null {
  if (node.type !== 'paragraph') return null
  const children = node.children ?? []
  if (children.length !== 1 || !isTextNode(children[0])) return null
  return children[0].value as string
}

function isMarkerSegment(segment: MdastFlowNode[]): boolean {
  if (segment.length !== 1 || !isTextNode(segment[0])) return false
  const text = segment[0].value as string
  return START_MARKER.test(text) || END_MARKER.test(text)
}

/**
 * 炸裂含围栏标记的融合段落
 *
 * commonmark preset 的 remarkLineBreak 把软换行解析为 break 节点，导致
 * `::: tip\n内容\n:::` 变成一个含 break 的段落而不是三个独立块。
 * 这里把「含有围栏标记行」的段落按 break 切成段：标记行独立成段，
 * 其余连续行保持 break 融合（不改变非 admonition 内容的序列化结果）。
 * 重拼时段间插入的是原始 break 节点而非新建——硬换行（`\`，isInline:false）
 * 必须保真，否则含硬换行的内容每次往返都会被改写成软换行。
 */
function explodeParagraph(node: MdastFlowNode): MdastFlowNode[] {
  if (node.type !== 'paragraph') return [node]
  const children = node.children ?? []
  if (!children.some((child) => child.type === 'break')) return [node]

  // 按 break 切段；separators[i] 是 segments[i] 与 segments[i+1] 之间的原始 break
  const segments: MdastFlowNode[][] = [[]]
  const separators: MdastFlowNode[] = []
  for (const child of children) {
    if (child.type === 'break') {
      separators.push(child)
      segments.push([])
    } else {
      segments[segments.length - 1].push(child)
    }
  }
  // 没有围栏标记行：保持原样
  if (!segments.some(isMarkerSegment)) return [node]

  const out: MdastFlowNode[] = []
  // buffer 项 = 段内容 + 它与前一个 buffered 段之间的原始 break
  let buffer: { sep: MdastFlowNode | null; segment: MdastFlowNode[] }[] = []
  const flush = () => {
    if (buffer.length === 0) return
    const merged: MdastFlowNode[] = []
    buffer.forEach((item, idx) => {
      if (idx > 0 && item.sep) merged.push(item.sep)
      merged.push(...item.segment)
    })
    out.push({ type: 'paragraph', children: merged })
    buffer = []
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const sep = i > 0 ? separators[i - 1] : null
    if (isMarkerSegment(segment)) {
      flush()
      out.push({ type: 'paragraph', children: segment })
    } else {
      buffer.push({ sep, segment })
    }
  }
  flush()
  return out
}

/**
 * 结束围栏定位：
 * - colon 形式：最近的 `:::` 行（对齐 markdown-it-container 等长围栏的配对行为）
 * - bang 内部形式：深度计数配对（预处理器保证 bang 内容无 `:::` 标记、嵌套 bang
 *   必然成对，故深度扫描必然命中；手写 `:::!` 的病态输入未命中则整体降级为段落，
 *   `:::!` 原文序列化回去，不改写用户内容）
 */
function findAdmonitionEnd(exploded: MdastFlowNode[], start: number, bang: boolean): number {
  let depth = 0
  for (let j = start + 1; j < exploded.length; j++) {
    const text = getMarkerText(exploded[j])
    if (text === null) continue
    if (bang && parseStartMarker(text)?.bang) {
      depth++
      continue
    }
    if (END_MARKER.test(text)) {
      if (depth === 0) return j
      depth--
    }
  }
  return -1
}

function transformChildren(parent: MdastFlowNode): void {
  const children = parent.children
  if (!children) return

  // 先炸裂融合段落，保证围栏标记是独立段落
  const exploded = children.flatMap((node) => explodeParagraph(node))

  const result: MdastFlowNode[] = []
  let i = 0
  while (i < exploded.length) {
    const node = exploded[i]
    const markerText = getMarkerText(node)
    const start = markerText !== null ? parseStartMarker(markerText) : null

    // colon 形式仅认已知类型（未知类型保持段落，对齐 markdown-it-container 未注册类型行为）；
    // bang 内部形式接受任意类型名（mkdocs 扩展类型原样保留进 attr，显示层降级 note）
    if (start && (start.bang || isAdmonitionType(start.type))) {
      const end = findAdmonitionEnd(exploded, i, start.bang)

      if (end === -1) {
        // 未闭合：保持普通段落降级，不丢内容
        result.push(node)
        i++
        continue
      }

      const inner = exploded.slice(i + 1, end)
      const admonition: MdastFlowNode = {
        type: 'admonition',
        admonitionType: start.bang ? start.type.toLowerCase() : start.type,
        title: start.title,
        syntax: start.bang ? 'bang' : 'colon',
        // content 要求 block+，空容器补一个空段落
        children: inner.length > 0 ? inner : [{ type: 'paragraph', children: [] }],
      }
      transformChildren(admonition)
      result.push(admonition)
      i = end + 1
      continue
    }

    // 递归处理其他容器（root / blockquote / listItem / admonition 嵌套等）
    transformChildren(node)
    result.push(node)
    i++
  }

  parent.children = result
}

// ==================== 2. mdast → markdown 序列化 handler ====================

/**
 * 尾部空段落判定：无子节点，或唯一子节点是空段落占位符 `<br>` 的 html 节点
 * （Milkdown 的 paragraph 序列化器把空段落编码为 html `<br />`）
 */
function isEmptyParagraphChild(child: MdastFlowNode): boolean {
  if (child.type !== 'paragraph') return false
  const children = child.children ?? []
  if (children.length === 0) return true
  const only = children[0]
  return (
    children.length === 1 &&
    only.type === 'html' &&
    typeof only.value === 'string' &&
    /^<br\s*\/?>$/i.test(only.value.trim())
  )
}

/** bang（`!!!`）形式的标题：引号包裹；含双引号时退回无引号原文（Python-Markdown 两种都收） */
function formatBangTitle(title: string): string {
  if (!title) return ''
  return title.includes('"') ? ` ${title}` : ` "${title}"`
}

/** bang 形式的内容：非空行加 4 空格缩进（空行保持真空，Python-Markdown 允许悬挂空行） */
function indentBangContent(content: string): string {
  return content
    .split('\n')
    .map((line) => (line.trim() === '' ? '' : `    ${line}`))
    .join('\n')
}

function admonitionToMarkdown(
  node: MdastFlowNode,
  _parent: unknown,
  state: ToMarkdownState,
  info: unknown
): string {
  const exit = state.enter('admonition')
  const tracker = state.createTracker(info)
  const type = typeof node.admonitionType === 'string' ? node.admonitionType : 'note'
  const title = typeof node.title === 'string' ? node.title : ''
  const bang = node.syntax === 'bang'

  let value = bang
    ? tracker.move(`!!! ${type}${formatBangTitle(title)}`)
    : tracker.move(`::: ${type}${title ? ` ${title}` : ''}`)
  // 丢弃尾部空段落：空行在 markdown 里本无语义；其序列化产物 `<br />` 若紧贴
  // 结束围栏，重解析时 micromark 会把 `<br />\n:::` 整体吞进 html 块（围栏丢失）
  const children = (node.children ?? []).slice()
  while (children.length > 0 && isEmptyParagraphChild(children[children.length - 1])) {
    children.pop()
  }
  const content = state.containerFlow({ ...node, children }, tracker.current())
  if (bang) {
    // bang 无结束围栏：内容每行缩进 4 空格定界；空容器只输出标记行
    if (content) value += tracker.move(`\n${indentBangContent(content)}`)
  } else if (content) {
    value += tracker.move(`\n${content}`)
    // 结束围栏前强制空行：防止末块与 `:::` 融合
    // （html 块吞行、blockquote 懒惰延续等都会把围栏吃进去）
    value += tracker.move('\n\n:::')
  } else {
    value += tracker.move('\n:::')
  }
  exit()
  return value
}

/** remark 插件：注册 stringify handler + 返回 mdast 变换 */
function remarkAdmonition(this: RemarkProcessorHost) {
  const data = this.data()
  const extensions = (data.toMarkdownExtensions ??= [])
  extensions.push({ handlers: { admonition: admonitionToMarkdown } })

  return (tree: MdastFlowNode) => {
    transformChildren(tree)
  }
}

export const remarkAdmonitionPlugin = $remark('remarkAdmonition', () => remarkAdmonition)

// ==================== 3. ProseMirror 节点 schema ====================

export const admonitionSchema = $nodeSchema('admonition', () => ({
  group: 'block',
  content: 'block+',
  defining: true,
  attrs: {
    admonitionType: {
      default: 'note',
      // bang 形式允许 mkdocs 扩展类型（abstract/question/...）：原样保留、显示降级 note
      validate: (value: unknown) => typeof value === 'string' && /^[a-z][\w-]*$/.test(value),
    },
    title: { default: '', validate: 'string' },
    /** 围栏形态：colon = `:::`（应用原生，新建默认）；bang = mkdocs `!!!`（语法保持往返） */
    syntax: {
      default: 'colon',
      validate: (value: unknown) => value === 'colon' || value === 'bang',
    },
  },
  parseDOM: [
    {
      tag: 'div.admonition',
      getAttrs: (dom) => {
        const el = dom as HTMLElement
        return {
          admonitionType: el.dataset.admonitionType ?? 'note',
          title: el.dataset.title ?? '',
          syntax: el.dataset.syntax === 'bang' ? 'bang' : 'colon',
        }
      },
    },
  ],
  toDOM: (node) => [
    'div',
    {
      class: `admonition ${node.attrs.admonitionType}`,
      'data-admonition-type': node.attrs.admonitionType,
      'data-title': node.attrs.title,
      'data-syntax': node.attrs.syntax,
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'admonition',
    runner: (state, node, proseType) => {
      state.openNode(proseType, {
        admonitionType: String(node.admonitionType ?? 'note'),
        title: String(node.title ?? ''),
        syntax: node.syntax === 'bang' ? 'bang' : 'colon',
      })
      state.next(node.children)
      state.closeNode()
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'admonition',
    runner: (state, node) => {
      state.openNode('admonition', undefined, {
        admonitionType: node.attrs.admonitionType,
        title: node.attrs.title,
        syntax: node.attrs.syntax,
      })
      state.next(node.content)
      state.closeNode()
    },
  },
}))
