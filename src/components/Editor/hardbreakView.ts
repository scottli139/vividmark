import { hardbreakSchema } from '@milkdown/kit/preset/commonmark'
import type { NodeView } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'

/**
 * hardbreak nodeview：isInline 软换行渲染为真实换行
 *
 * Milkdown 默认把 isInline:true 的 hardbreak 渲染成带空格的 <span>
 * （视觉上不换行）——「单换行模型」（Enter = 行内软换行）下三行会挤在
 * 一行显示。本 nodeview 统一渲染为 <br>，编辑器里真实换行。
 * data-type / data-is-inline 属性保留，供 strictBrParserPlugin 回读识别。
 */
export const hardbreakView = $view(hardbreakSchema.node, () => {
  return (initialNode): NodeView => {
    let node = initialNode
    const dom = document.createElement('br')
    const sync = () => {
      dom.dataset.type = 'hardbreak'
      dom.dataset.isInline = String(node.attrs.isInline)
    }
    sync()
    return {
      dom,
      update(updated) {
        if (updated.type.name !== node.type.name) return false
        node = updated
        sync()
        return true
      },
    }
  }
})
