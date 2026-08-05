import type { Node } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
import { listItemSchema } from '@milkdown/kit/preset/commonmark'
import { $view } from '@milkdown/kit/utils'

/**
 * 任务列表项 nodeview
 *
 * GFM preset 的 list_item schema 只输出 <li data-item-type="task" data-checked="...">，
 * 没有可交互的 checkbox。这里为任务项渲染 <input type="checkbox"> + 内容容器，
 * 点击 checkbox 通过 setNodeMarkup 切换 checked attr（复用预览区的 task-list-item/
 * task-checkbox/task-content 样式）；非任务项保持原生 <li> 渲染（CSS list-style 出 marker）。
 */
export const taskListItemView = $view(listItemSchema.node, () => {
  return (initialNode, view, getPos): NodeView => {
    let node = initialNode

    const isTaskItem = (n: Node) => n.attrs.checked !== null && n.attrs.checked !== undefined

    const li = document.createElement('li')
    li.dataset.label = node.attrs.label
    li.dataset.listType = node.attrs.listType
    li.dataset.spread = String(node.attrs.spread)

    let contentDOM: HTMLElement = li
    let checkbox: HTMLInputElement | null = null

    if (isTaskItem(node)) {
      li.dataset.itemType = 'task'
      li.dataset.checked = String(node.attrs.checked)
      li.classList.add('task-list-item')

      checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.className = 'task-checkbox'
      checkbox.checked = node.attrs.checked === true
      checkbox.setAttribute('contenteditable', 'false')
      checkbox.addEventListener('click', (e) => {
        // 阻止浏览器默认切换：checked 状态由 ProseMirror 文档驱动（update 中回写）
        e.preventDefault()
        if (!view.editable) return
        const pos = getPos()
        if (typeof pos !== 'number') return
        view.dispatch(
          view.state.tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            checked: node.attrs.checked !== true,
          })
        )
      })

      const content = document.createElement('span')
      content.className = 'task-content'
      li.append(checkbox, content)
      contentDOM = content
    }

    return {
      dom: li,
      contentDOM,
      update(updatedNode: Node) {
        if (updatedNode.type.name !== node.type.name) return false
        // 任务项 ↔ 普通列表项转换：返回 false 让 ProseMirror 重建 nodeview
        if (isTaskItem(updatedNode) !== isTaskItem(node)) return false
        node = updatedNode
        li.dataset.label = node.attrs.label
        li.dataset.listType = node.attrs.listType
        li.dataset.spread = String(node.attrs.spread)
        if (checkbox) {
          li.dataset.checked = String(node.attrs.checked)
          checkbox.checked = node.attrs.checked === true
        }
        return true
      },
      // checkbox 的 DOM 变化不由 ProseMirror 管理，忽略 contentDOM 之外的 mutation
      ignoreMutation(mutation) {
        return !contentDOM.contains(mutation.target)
      },
      // checkbox 上的事件由自身 listener 处理，不交给 ProseMirror（避免触发选区移动）
      stopEvent(event) {
        return checkbox !== null && event.target === checkbox
      },
    }
  }
})
