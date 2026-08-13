import katex from 'katex'
import type { Node } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { $view } from '@milkdown/kit/utils'
import { mathBlockSchema, mathInlineSchema } from './mathPlugin'

/**
 * 数学公式节点 nodeview（纯 DOM，仿 admonitionView.ts 模式）
 *
 * 双态结构：
 * - 渲染态：katex.render 到 preview 元素（throwOnError:false，错误公式显示红色提示）
 * - 编辑态：点击进入（行内单击 / 块级双击）显示 textarea 编辑 LaTeX 源码；
 *   提交 = blur / 行内 Enter / 块级 Cmd/Ctrl+Enter（dispatch setNodeMarkup 更新 attrs.value），
 *   Escape 取消还原
 *
 * LaTeX 源码只存 attrs.value，节点无 contentDOM（atom 叶子），
 * 序列化由 mathPlugin.ts 的 toMarkdown runner 负责。
 */

function createMathView(
  initialNode: Node,
  view: EditorView,
  getPos: () => number | undefined,
  displayMode: boolean
): NodeView {
  let node = initialNode
  let editing = false

  const dom = document.createElement(displayMode ? 'div' : 'span')
  dom.className = displayMode ? 'math-block' : 'math-inline'
  dom.setAttribute('contenteditable', 'false')

  const preview = document.createElement(displayMode ? 'div' : 'span')
  preview.className = 'math-preview'

  const editor = document.createElement('textarea')
  editor.className = 'math-editor'
  editor.style.display = 'none'
  editor.rows = displayMode ? 3 : 1
  editor.spellcheck = false

  dom.append(preview, editor)

  const renderPreview = () => {
    preview.textContent = ''
    try {
      katex.render(node.attrs.value as string, preview, {
        displayMode,
        throwOnError: false,
      })
    } catch {
      // throwOnError:false 下不应到达，兜底显示源码
      preview.textContent = node.attrs.value as string
    }
  }
  renderPreview()

  const openEditor = () => {
    if (editing) return
    editing = true
    dom.classList.add('math-editing')
    editor.value = node.attrs.value as string
    preview.style.display = 'none'
    editor.style.display = ''
    editor.focus()
  }

  const closeEditor = (commit: boolean) => {
    if (!editing) return
    editing = false
    dom.classList.remove('math-editing')
    preview.style.display = ''
    editor.style.display = 'none'

    const value = editor.value
    if (commit && value !== node.attrs.value) {
      const pos = getPos()
      if (typeof pos === 'number') {
        view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { value }))
      }
    }
    view.focus()
  }

  preview.addEventListener(displayMode ? 'dblclick' : 'click', (event) => {
    event.preventDefault()
    openEditor()
  })
  editor.addEventListener('blur', () => closeEditor(true))
  editor.addEventListener('keydown', (event) => {
    // 阻止冒泡到 PM / 全局快捷键（Escape 在 Editor.tsx 有全局退出编辑态绑定）
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      closeEditor(false)
      return
    }
    const isCommitKey = displayMode
      ? event.key === 'Enter' && (event.metaKey || event.ctrlKey)
      : event.key === 'Enter'
    if (isCommitKey) {
      event.preventDefault()
      closeEditor(true)
    }
  })

  return {
    dom,
    update(updatedNode) {
      if (updatedNode.type.name !== node.type.name) return false
      node = updatedNode
      if (!editing) renderPreview()
      return true
    },
    selectNode() {
      dom.classList.add('math-selected')
    },
    deselectNode() {
      dom.classList.remove('math-selected')
    },
    // 编辑态下 textarea 事件全部自处理；渲染态 preview 的点击也不进 PM 选区逻辑
    stopEvent(event) {
      return editing || preview.contains(event.target as globalThis.Node)
    },
    // 内部 DOM（preview/editor）变化均非文档内容变化
    ignoreMutation() {
      return true
    },
  }
}

export const mathInlineView = $view(mathInlineSchema.node, () => {
  return (node, view, getPos) => createMathView(node, view, getPos, false)
})

export const mathBlockView = $view(mathBlockSchema.node, () => {
  return (node, view, getPos) => createMathView(node, view, getPos, true)
})
