import { htmlSchema } from '@milkdown/kit/preset/commonmark'
import type { NodeView } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'

/**
 * html 节点视图：`<br>` 系列标签渲染为真实换行
 *
 * Milkdown 默认把内联 html 节点（atom）渲染成字面文本 span——GFM 表格单元格
 * 里常用的 `<br>` 换行写法（GitHub/Typora 均渲染为换行）在所见即所得下显示为
 * 原始字符。本 nodeview 把 `<br>`/`<br/>`/`<br />`（大小写不敏感）渲染为真实
 * <br> 元素；其余内联 html 维持字面显示不变。
 *
 * 序列化不受影响（html 节点 toMarkdown 恒输出 attrs.value 原文，往返无损）。
 * data-type/data-value 属性供 strictBrParserPlugin 的 `br[data-type="html"]`
 * 规则回读，保证编辑器内 DOM 重解析不丢节点。
 */
const BR_TAG = /^<br\s*\/?\s*>$/i

const isBrValue = (value: unknown): value is string =>
  typeof value === 'string' && BR_TAG.test(value.trim())

export const htmlView = $view(htmlSchema.node, () => {
  return (initialNode): NodeView => {
    let node = initialNode
    let isBr = isBrValue(node.attrs.value)
    const dom = document.createElement(isBr ? 'br' : 'span')
    const sync = () => {
      dom.dataset.type = 'html'
      dom.dataset.value = node.attrs.value
      if (!isBr) dom.textContent = node.attrs.value
    }
    sync()
    return {
      dom,
      update(updated) {
        if (updated.type.name !== node.type.name) return false
        const updatedIsBr = isBrValue(updated.attrs.value)
        // br 与 span 元素类型不同，无法原地切换，交还 PM 重建
        if (updatedIsBr !== isBr) return false
        node = updated
        isBr = updatedIsBr
        sync()
        return true
      },
    }
  }
})
