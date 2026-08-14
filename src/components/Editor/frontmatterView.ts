import type { Node } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'
import { frontmatterSchema } from './frontmatterPlugin'

/**
 * frontmatter 节点 nodeview（纯 DOM，仿 mathView.ts 模式）
 *
 * 只读展示 YAML 原文（编辑走 Source 模式）：标签行 + pre 源码块，
 * contenteditable=false。YAML 源码只存 attrs.value，节点无 contentDOM（atom 叶子），
 * 序列化由 frontmatterPlugin.ts 的 toMarkdown runner 负责。
 */

function createFrontmatterView(initialNode: Node): NodeView {
  let node = initialNode

  const dom = document.createElement('div')
  dom.className = 'frontmatter'
  dom.setAttribute('contenteditable', 'false')

  const label = document.createElement('div')
  label.className = 'frontmatter-label'
  label.textContent = 'Frontmatter'

  const pre = document.createElement('pre')
  pre.className = 'frontmatter-content'
  pre.textContent = node.attrs.value as string

  dom.append(label, pre)

  return {
    dom,
    update(updatedNode) {
      if (updatedNode.type.name !== node.type.name) return false
      node = updatedNode
      pre.textContent = node.attrs.value as string
      return true
    },
    selectNode() {
      dom.classList.add('frontmatter-selected')
    },
    deselectNode() {
      dom.classList.remove('frontmatter-selected')
    },
    // atom 只读节点：事件全部自处理，不进 PM 选区/编辑逻辑
    stopEvent() {
      return true
    },
    // 内部 DOM（label/pre）变化均非文档内容变化
    ignoreMutation() {
      return true
    },
  }
}

export const frontmatterView = $view(frontmatterSchema.node, () => {
  return (node) => createFrontmatterView(node)
})
