import { undoDepth, redoDepth } from '@milkdown/kit/prose/history'
import { Plugin } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'
import { useEditorStore } from '../../stores/editorStore'

/**
 * 把 PM history 的 undo/redo 深度同步到 store 的 canUndo/canRedo
 * （与 CodeMirror 同一套 store 契约，驱动工具栏按钮 disabled 态）。
 * 仅在 wysiwyg 激活时写入——source/split 下由 CM 的 updateListener 负责（viewMode 分流）。
 */
export const wysiwygHistoryPlugin = $prose(() => {
  return new Plugin({
    view: () => ({
      update: (view) => {
        const store = useEditorStore.getState()
        if (store.viewMode !== 'wysiwyg') return
        const canUndo = undoDepth(view.state) > 0
        const canRedo = redoDepth(view.state) > 0
        if (canUndo !== store.canUndo) store.setCanUndo(canUndo)
        if (canRedo !== store.canRedo) store.setCanRedo(canRedo)
      },
    }),
  })
})
