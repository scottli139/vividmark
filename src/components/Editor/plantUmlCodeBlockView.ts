import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import { $view } from '@milkdown/kit/utils'
import { getPlantUmlSvgUrl } from '../../lib/plantuml'

/** 源码编辑后预览刷新的防抖窗口（ms），避免每次击键都发图片请求 */
const PREVIEW_REFRESH_DELAY = 500

function isPlantUmlNode(node: ProseNode): boolean {
  return node.attrs.language === 'plantuml'
}

function encodePreviewSrc(img: HTMLImageElement, node: ProseNode) {
  try {
    img.src = getPlantUmlSvgUrl(node.textContent)
  } catch {
    // 编码失败：移除 src，显示破图占位样式（globals.css .plantuml-load-error）
    img.removeAttribute('src')
    img.classList.add('plantuml-load-error')
  }
}

/**
 * 代码块 nodeview：
 * - plantuml 代码块：上方预览图（contentEditable=false，复用 .plantuml-diagram 样式），
 *   下方源码区保留 contentDOM 始终可编辑；序列化走原 code_block 路径，天然无损
 * - 其他代码块：`pre.hljs > code`（hljs class 让基色/等宽规则与预览一致），右上角附
 *   语言输入框（contenteditable=false，不在 contentDOM 内，PM 不管理）；
 *   输入语言名即驱动 codeHighlightPlugin 高亮，输入 plantuml 则走 update() 返回 false
 *   的既有路径重建为预览双区
 * - language attr 变化导致 plantuml ↔ 非 plantuml 切换时 update() 返回 false 重建
 */
export const plantUmlCodeBlockView = $view(codeBlockSchema.node, () => {
  return (initialNode, view: EditorView, getPos): NodeView => {
    let node = initialNode
    let previewTimer: ReturnType<typeof setTimeout> | null = null

    let dom: HTMLElement
    let contentDOM: HTMLElement
    let previewImg: HTMLImageElement | null = null
    let langInput: HTMLInputElement | null = null

    /** 把语言输入框的值写回 language attr（无变化不 dispatch，避免产生空事务/脏标记） */
    const commitLanguage = (value: string) => {
      const language = value.trim()
      if (language === String(node.attrs.language ?? '')) return
      if (typeof getPos !== 'function') return
      const pos = getPos()
      if (pos === undefined) return
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language }))
    }

    /** 语言输入框：Enter 提交并回到编辑区；Escape 还原并回到编辑区；blur 提交 */
    const createLangInput = (): HTMLInputElement => {
      const input = document.createElement('input')
      input.className = 'code-block-lang'
      input.setAttribute('contenteditable', 'false')
      input.spellcheck = false
      input.placeholder = 'lang'
      input.value = String(node.attrs.language ?? '')
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commitLanguage(input.value)
          view.focus()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          input.value = String(node.attrs.language ?? '')
          view.focus()
        }
      })
      input.addEventListener('blur', () => commitLanguage(input.value))
      return input
    }

    if (isPlantUmlNode(node)) {
      dom = document.createElement('div')
      dom.className = 'plantuml-block'

      const preview = document.createElement('div')
      preview.className = 'plantuml-diagram'
      preview.setAttribute('contenteditable', 'false')
      previewImg = document.createElement('img')
      previewImg.alt = 'PlantUML Diagram'
      previewImg.loading = 'lazy'
      previewImg.onerror = () => previewImg?.classList.add('plantuml-load-error')
      previewImg.onload = () => previewImg?.classList.remove('plantuml-load-error')
      encodePreviewSrc(previewImg, node)
      preview.appendChild(previewImg)

      const pre = document.createElement('pre')
      pre.dataset.language = node.attrs.language
      pre.spellcheck = false
      const code = document.createElement('code')
      pre.appendChild(code)

      dom.append(preview, pre)
      contentDOM = code
    } else {
      const pre = document.createElement('pre')
      pre.classList.add('hljs')
      pre.spellcheck = false
      if (node.attrs.language) pre.dataset.language = node.attrs.language
      langInput = createLangInput()
      const code = document.createElement('code')
      pre.append(langInput, code)
      dom = pre
      contentDOM = code
    }

    return {
      dom,
      contentDOM,
      update(updatedNode) {
        if (updatedNode.type.name !== node.type.name) return false
        // plantuml ↔ 非 plantuml 切换：DOM 结构不同，重建 nodeview
        if (isPlantUmlNode(updatedNode) !== isPlantUmlNode(node)) return false
        node = updatedNode
        // 外部变化（undo、source 模式改完后切回）同步输入框；正在输入时不打扰
        if (langInput && document.activeElement !== langInput) {
          langInput.value = String(node.attrs.language ?? '')
        }
        if (previewImg) {
          if (previewTimer) clearTimeout(previewTimer)
          const img = previewImg
          const current = node
          previewTimer = setTimeout(() => encodePreviewSrc(img, current), PREVIEW_REFRESH_DELAY)
        }
        return true
      },
      // 预览区/语言输入框的 DOM 变化不由 ProseMirror 管理（都在 contentDOM 之外）
      ignoreMutation(mutation) {
        return !contentDOM.contains(mutation.target)
      },
      // 语言输入框的事件不交给 ProseMirror（按键/点击不被编辑器拦截）
      stopEvent(event) {
        return (
          langInput !== null &&
          event.target instanceof globalThis.Node &&
          langInput.contains(event.target)
        )
      },
      destroy() {
        if (previewTimer) clearTimeout(previewTimer)
      },
    }
  }
})
