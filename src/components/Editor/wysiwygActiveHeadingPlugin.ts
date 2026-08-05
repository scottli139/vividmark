import { Plugin } from '@milkdown/kit/prose/state'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { $prose } from '@milkdown/kit/utils'
import { useEditorStore } from '../../stores/editorStore'

/**
 * 计算 pos 之前（含所处）最后一个 heading 是全文第几个（0-based，
 * 与 OutlineItem.index / editor-scroll-to-heading 的计数口径一致）。
 * 文档无 heading 或 pos 在第一个 heading 之前时返回 null。
 */
export function findActiveHeadingIndex(doc: ProseNode, pos: number): number | null {
  let activeIndex: number | null = null
  let count = 0
  // descendants 按文档顺序遍历、位置单调不减；nodePos >= pos 的节点及其子孙不再计入
  doc.descendants((node, nodePos) => {
    if (nodePos >= pos) return false
    if (node.type.name === 'heading') {
      activeIndex = count
      count++
    }
    return true
  })
  return activeIndex
}

/**
 * selection/doc 变化时把「光标之前（含所处）最后一个 heading 的序号」写入
 * store.activeHeadingIndex，驱动大纲的当前位置高亮。
 * 仅在 wysiwyg 激活时写入——source/split 由 Sidebar 按 cursorLine 规则推导。
 */
export const wysiwygActiveHeadingPlugin = $prose(() => {
  return new Plugin({
    view: (view) => {
      // 编辑器（重）创建时对齐一次：打开新文件后初始 selection 通常在文档开头
      const store = useEditorStore.getState()
      if (store.viewMode === 'wysiwyg') {
        store.setActiveHeadingIndex(
          findActiveHeadingIndex(view.state.doc, view.state.selection.from)
        )
      }
      return {
        update: (view, prevState) => {
          const store = useEditorStore.getState()
          if (store.viewMode !== 'wysiwyg') return
          // 仅 selection 或 doc 变化时重算；store 侧相等守卫拦截同值写入
          if (view.state.doc === prevState.doc && view.state.selection.eq(prevState.selection)) {
            return
          }
          store.setActiveHeadingIndex(
            findActiveHeadingIndex(view.state.doc, view.state.selection.from)
          )
        },
      }
    },
  })
})
