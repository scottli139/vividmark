import type { NodeView } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'
import { getAdmonitionDisplayTitle } from '../../lib/markdown/admonitionTypes'
import { admonitionSchema } from './admonitionPlugin'

/**
 * Admonition 节点 nodeview（纯 DOM）
 *
 * 直接复用 globals.css 的 .admonition / .admonition-title / .admonition-content 样式
 * （亮暗两套变量自动生效）。标题区 contentEditable=false（attrs 不进文档内容），
 * 内容区为 contentDOM，内部块（列表、代码块、嵌套 admonition）正常编辑。
 */
export const admonitionView = $view(admonitionSchema.node, () => {
  return (initialNode): NodeView => {
    let node = initialNode

    const dom = document.createElement('div')
    dom.className = `admonition ${node.attrs.admonitionType}`
    dom.dataset.admonitionType = node.attrs.admonitionType
    dom.dataset.title = node.attrs.title

    const titleDiv = document.createElement('div')
    titleDiv.className = 'admonition-title'
    titleDiv.setAttribute('contenteditable', 'false')
    titleDiv.textContent = getAdmonitionDisplayTitle(node.attrs.admonitionType, node.attrs.title)

    const contentDiv = document.createElement('div')
    contentDiv.className = 'admonition-content'

    dom.append(titleDiv, contentDiv)

    return {
      dom,
      contentDOM: contentDiv,
      update(updatedNode) {
        if (updatedNode.type.name !== node.type.name) return false
        // 类型变化：class/样式全套不同，重建 nodeview
        if (updatedNode.attrs.admonitionType !== node.attrs.admonitionType) return false
        node = updatedNode
        dom.dataset.title = node.attrs.title
        titleDiv.textContent = getAdmonitionDisplayTitle(
          node.attrs.admonitionType,
          node.attrs.title
        )
        return true
      },
      // 标题区 DOM 变化不由 ProseMirror 管理
      ignoreMutation(mutation) {
        return !contentDiv.contains(mutation.target)
      },
      // 标题区事件不交给 ProseMirror（避免点击标题触发选区移动）
      stopEvent(event) {
        return event.target instanceof Node && titleDiv.contains(event.target)
      },
    }
  }
})
