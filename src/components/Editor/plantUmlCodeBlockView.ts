import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { NodeView } from '@milkdown/kit/prose/view'
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
 * 代码块 nodeview：plantuml 语言渲染「预览图 + 可编辑源码」双区
 *
 * - 非 plantuml 代码块：复刻 schema 默认渲染（pre > code，contentDOM=code）
 * - plantuml 代码块：上方预览图（contentEditable=false，复用 .plantuml-diagram 样式），
 *   下方源码区保留 contentDOM 始终可编辑；序列化走原 code_block 路径，天然无损
 * - language attr 变化导致 plantuml ↔ 非 plantuml 切换时 update() 返回 false 重建
 */
export const plantUmlCodeBlockView = $view(codeBlockSchema.node, () => {
  return (initialNode): NodeView => {
    let node = initialNode
    let previewTimer: ReturnType<typeof setTimeout> | null = null

    let dom: HTMLElement
    let contentDOM: HTMLElement
    let previewImg: HTMLImageElement | null = null

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
      const code = document.createElement('code')
      pre.appendChild(code)

      dom.append(preview, pre)
      contentDOM = code
    } else {
      const pre = document.createElement('pre')
      if (node.attrs.language) pre.dataset.language = node.attrs.language
      const code = document.createElement('code')
      pre.appendChild(code)
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
        if (previewImg) {
          if (previewTimer) clearTimeout(previewTimer)
          const img = previewImg
          const current = node
          previewTimer = setTimeout(() => encodePreviewSrc(img, current), PREVIEW_REFRESH_DELAY)
        }
        return true
      },
      // 预览区 DOM 变化不由 ProseMirror 管理
      ignoreMutation(mutation) {
        return !contentDOM.contains(mutation.target)
      },
      destroy() {
        if (previewTimer) clearTimeout(previewTimer)
      },
    }
  }
})
