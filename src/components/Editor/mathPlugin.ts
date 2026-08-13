import { $inputRule, $nodeSchema, $remark } from '@milkdown/kit/utils'
import { InputRule } from '@milkdown/kit/prose/inputrules'
import remarkMath from 'remark-math'

/**
 * KaTeX 数学公式 Milkdown 支持
 *
 * 三部分（仿 admonitionPlugin.ts 模式）：
 * 1. remark-math（remarkMathPlugin）：自动注册 micromark 解析扩展 +
 *    mdast-util-math 的 toMarkdown 序列化扩展（与 admonition 同一接入点
 *    data('toMarkdownExtensions')）。mdast 节点：inline `inlineMath`、
 *    块级 `math`，均携带 `value`（LaTeX 源码）。
 * 2. $nodeSchema ×2：math_inline（atom 行内节点）/ math_block（atom 块级节点），
 *    LaTeX 源码存 attrs.value，节点本身不承载可编辑内容（编辑走 nodeview 编辑态）。
 * 3. mathInlineInputRule：输入闭合 `$` 时把 `$...$` 文本替换为 math_inline 节点
 *    （Typora 同款体验）。正则不匹配首尾空白与嵌套 `$`，与 micromark mathText 对齐。
 *
 * 渲染与编辑交互在 mathView.ts（$view 纯 DOM nodeview，katex.render）。
 */

/** remark-math 插件（解析 + 序列化全注册） */
export const remarkMathPlugin = $remark('remarkMath', () => remarkMath)

/** 从 mdast 节点提取 value 字段（mdast-util-math 节点带 value: string） */
function getMathValue(node: unknown): string {
  const value = (node as { value?: unknown }).value
  return typeof value === 'string' ? value : ''
}

// ==================== math_inline（行内公式） ====================

export const mathInlineSchema = $nodeSchema('math_inline', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  parseDOM: [
    {
      tag: 'span.math-inline',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }),
    },
  ],
  toDOM: (node) => ['span', { class: 'math-inline', 'data-value': node.attrs.value as string }],
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, proseType) => {
      state.addNode(proseType, { value: getMathValue(node) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_inline',
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, String(node.attrs.value))
    },
  },
}))

// ==================== math_block（块级公式） ====================

export const mathBlockSchema = $nodeSchema('math_block', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  defining: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  parseDOM: [
    {
      tag: 'div.math-block',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }),
    },
  ],
  toDOM: (node) => ['div', { class: 'math-block', 'data-value': node.attrs.value as string }],
  parseMarkdown: {
    match: (node) => node.type === 'math',
    runner: (state, node, proseType) => {
      state.addNode(proseType, { value: getMathValue(node) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'math_block',
    runner: (state, node) => {
      state.addNode('math', undefined, String(node.attrs.value))
    },
  },
}))

// ==================== 输入规则（$...$ 自动转公式节点） ====================

/**
 * 输入闭合 `$` 时触发：开 `$` + 首字符非空白/非 `$` + 内容（不含 `$`，尾部非空白）+ 闭 `$`。
 * 锚定光标前文本结尾（prosemirror InputRule 惯例）。
 */
export const mathInlineInputRule = $inputRule(
  () =>
    new InputRule(/\$([^\s$](?:[^$]*[^\s$])?)\$$/, (state, match, start, end) => {
      const value = match[1]
      if (!value) return null
      const mathInline = state.schema.nodes.math_inline
      if (!mathInline) return null
      return state.tr.replaceWith(start, end, mathInline.create({ value }))
    })
)
