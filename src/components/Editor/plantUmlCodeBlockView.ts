import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView, NodeView } from '@milkdown/kit/prose/view'
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark'
import { $view } from '@milkdown/kit/utils'
import { getPlantUmlSvgUrl, renderPlantUmlSvg } from '../../lib/plantuml'
import { useEditorStore } from '../../stores/editorStore'

/** 源码编辑后预览刷新的防抖窗口（ms），避免每次击键都触发渲染 */
const PREVIEW_REFRESH_DELAY = 500

function isPlantUmlNode(node: ProseNode): boolean {
  return node.attrs.language === 'plantuml'
}

/** 本地渲染失败时回退在线服务 img（沿用破图占位样式 globals.css .plantuml-load-error） */
function showOnlineFallback(preview: HTMLElement, source: string) {
  const img = document.createElement('img')
  img.alt = 'PlantUML Diagram'
  img.loading = 'lazy'
  img.onerror = () => img.classList.add('plantuml-load-error')
  img.onload = () => img.classList.remove('plantuml-load-error')
  try {
    img.src = getPlantUmlSvgUrl(source)
  } catch {
    // 编码失败：移除 src，显示破图占位样式
    img.removeAttribute('src')
    img.classList.add('plantuml-load-error')
  }
  preview.innerHTML = ''
  preview.appendChild(img)
}

/**
 * 代码块 nodeview：
 * - plantuml 代码块：上方预览（contentEditable=false，本地引擎离线渲染内联 SVG，
 *   失败回退在线服务，复用 .plantuml-diagram 样式），下方源码区保留 contentDOM 始终可编辑；
 *   序列化走原 code_block 路径，天然无损
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
    // 渲染序号：防抖期间源码再变/主题再切时，使进行中的旧渲染失效
    let previewSeq = 0

    let dom: HTMLElement
    let contentDOM: HTMLElement
    let previewEl: HTMLElement | null = null
    let langInput: HTMLInputElement | null = null
    let unsubscribeTheme: (() => void) | null = null

    /** 本地引擎渲染预览（暗色跟随应用主题） */
    const renderPreview = async (source: string, seq: number) => {
      if (!previewEl) return
      try {
        const svg = await renderPlantUmlSvg(source, {
          dark: useEditorStore.getState().isDarkMode,
        })
        if (previewEl && seq === previewSeq) previewEl.innerHTML = svg
      } catch {
        if (previewEl && seq === previewSeq) showOnlineFallback(previewEl, source)
      }
    }

    /** 源码变化后防抖刷新预览 */
    const schedulePreviewRender = (sourceNode: ProseNode) => {
      if (previewTimer) clearTimeout(previewTimer)
      previewTimer = setTimeout(() => {
        previewTimer = null
        void renderPreview(sourceNode.textContent, ++previewSeq)
      }, PREVIEW_REFRESH_DELAY)
    }

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
      preview.innerHTML = '<div class="plantuml-loading"></div>'
      previewEl = preview

      const pre = document.createElement('pre')
      pre.dataset.language = node.attrs.language
      pre.spellcheck = false
      const code = document.createElement('code')
      pre.appendChild(code)

      dom.append(preview, pre)
      contentDOM = code

      void renderPreview(node.textContent, ++previewSeq)
      // 主题切换：按新 dark 参数重渲染（SVG 颜色在渲染期确定，CSS 变量管不到 SVG 内部）
      unsubscribeTheme = useEditorStore.subscribe((state, prev) => {
        if (state.isDarkMode !== prev.isDarkMode) {
          void renderPreview(node.textContent, ++previewSeq)
        }
      })
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
        if (previewEl) {
          schedulePreviewRender(node)
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
        previewSeq++ // 使进行中的渲染失效
        unsubscribeTheme?.()
      },
    }
  }
})
