import { $nodeSchema, $remark } from '@milkdown/kit/utils'
import remarkFrontmatter from 'remark-frontmatter'

/**
 * YAML frontmatter Milkdown 支持（仿 mathPlugin.ts 模式）
 *
 * 两部分：
 * 1. remark-frontmatter（remarkFrontmatterPlugin）：注册 micromark-extension-frontmatter
 *    （文档开头 `---` 围栏解析为 mdast `yaml` 节点）与 mdast-util-frontmatter 的
 *    toMarkdown 序列化扩展（`yaml` 节点 → `---\n...\n---`，value 逐字节保留）。
 *    仅文档起始位置生效；文档中间的 `---` 仍是分割线（thematicBreak）。
 * 2. $nodeSchema：frontmatter（atom 块级节点），YAML 源码存 attrs.value，
 *    节点本身不承载可编辑内容（只读展示，编辑走 Source 模式）。
 *
 * 渲染在 frontmatterView.ts（$view 纯 DOM nodeview，只读展示 YAML 原文）。
 */

/** remark-frontmatter 插件（解析 + 序列化全注册）。
 * 第三参 'yaml' 必传：$remark 的 options 默认 {}，Milkdown 会原样 .use(plugin, options)，
 * 而 micromark frontmatter 把 {} 当 matter 对象校验（缺 type 字段）直接抛错 */
export const remarkFrontmatterPlugin = $remark('remarkFrontmatter', () => remarkFrontmatter, 'yaml')

/** 从 mdast 节点提取 value 字段（mdast-util-frontmatter 的 yaml 节点带 value: string） */
function getFrontmatterValue(node: unknown): string {
  const value = (node as { value?: unknown }).value
  return typeof value === 'string' ? value : ''
}

export const frontmatterSchema = $nodeSchema('frontmatter', () => ({
  group: 'block',
  atom: true,
  selectable: true,
  defining: true,
  attrs: {
    value: { default: '', validate: 'string' },
  },
  parseDOM: [
    {
      tag: 'div.frontmatter',
      getAttrs: (dom) => ({ value: (dom as HTMLElement).dataset.value ?? '' }),
    },
  ],
  toDOM: (node) => ['div', { class: 'frontmatter', 'data-value': node.attrs.value as string }],
  parseMarkdown: {
    match: (node) => node.type === 'yaml',
    runner: (state, node, proseType) => {
      state.addNode(proseType, { value: getFrontmatterValue(node) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'frontmatter',
    runner: (state, node) => {
      state.addNode('yaml', undefined, String(node.attrs.value))
    },
  },
}))
