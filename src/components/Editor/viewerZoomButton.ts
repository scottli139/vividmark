import i18n from '../../i18n'
import { openImageViewer } from '../../lib/diagramZoom'

/** 放大镜图标（currentColor，随按钮颜色） */
const ZOOM_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5M11 8v6M8 11h6"/></svg>`

/**
 * WYSIWYG nodeview 用的放大查看按钮（图表预览区 / 图片节点共用）。
 * hover 显形、样式见 globals.css `.diagram-zoom-button`；
 * 在 contentDOM 之外不进序列化，事件需由 nodeview 的 stopEvent 拦截（不交给 PM）。
 * 点击时 getHtml() 返回 null（loading/error 态）则不动作。
 */
export function createViewerZoomButton(getHtml: () => string | null): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'diagram-zoom-button'
  button.title = i18n.t('imageViewer.zoomIn')
  button.setAttribute('aria-label', i18n.t('imageViewer.zoomIn'))
  button.setAttribute('contenteditable', 'false')
  button.innerHTML = ZOOM_ICON
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    const html = getHtml()
    if (html) openImageViewer(html)
  })
  return button
}
