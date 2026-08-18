import type { NodeView } from '@milkdown/kit/prose/view'
import { imageSchema } from '@milkdown/kit/preset/commonmark'
import { $view } from '@milkdown/kit/utils'
import { getBaseDirFromFilePath, resolveImageSrc } from '../../lib/imageSrc'
import { createViewerZoomButton } from './viewerZoomButton'
import { useEditorStore } from '../../stores/editorStore'

/**
 * 图片节点 nodeview（纯 DOM）
 *
 * 渲染 <img> 时把相对路径 src（如 ./assets/x.png）解析为可显示 URL
 * （convertFileSrc 优先，见 imageSrc.ts）；**节点 attrs.src 保持原文不改**，
 * 序列化走原 image 路径，天然无损。网络图 / data: URL 直接透传。
 * 加载失败显示占位样式（globals.css .wysiwyg-image-load-error）。
 */
export const imageView = $view(imageSchema.node, () => {
  return (initialNode): NodeView => {
    let node = initialNode

    const dom = document.createElement('span')
    dom.className = 'wysiwyg-image'

    const img = document.createElement('img')
    const errorPlaceholder = document.createElement('span')
    errorPlaceholder.className = 'wysiwyg-image-error'

    const syncContent = () => {
      img.alt = node.attrs.alt ?? ''
      if (node.attrs.title) img.title = node.attrs.title
      // 只改 DOM 属性：节点 attrs.src 始终保留 Markdown 原文
      const baseDir = getBaseDirFromFilePath(useEditorStore.getState().filePath)
      img.src = resolveImageSrc(node.attrs.src, baseDir)
      errorPlaceholder.textContent = `🖼 ${node.attrs.src}${node.attrs.alt ? ` (${node.attrs.alt})` : ''}`
    }

    img.onerror = () => dom.classList.add('wysiwyg-image-load-error')
    img.onload = () => dom.classList.remove('wysiwyg-image-load-error')

    // 放大查看按钮（hover 显形；破图占位态不打开）
    const zoomButton = createViewerZoomButton(() =>
      dom.classList.contains('wysiwyg-image-load-error') ? null : img.outerHTML
    )

    syncContent()
    dom.append(img, errorPlaceholder, zoomButton)

    return {
      dom,
      update(updatedNode) {
        if (updatedNode.type.name !== node.type.name) return false
        node = updatedNode
        syncContent()
        return true
      },
      // 叶子节点无 contentDOM，所有 DOM 变化都由本 nodeview 管理
      ignoreMutation: () => true,
      // 放大按钮的事件不交给 ProseMirror（保留点击图片选中节点的既有行为）
      stopEvent(event) {
        return event.target instanceof globalThis.Node && zoomButton.contains(event.target)
      },
      selectNode() {
        dom.classList.add('ProseMirror-selectednode')
      },
      deselectNode() {
        dom.classList.remove('ProseMirror-selectednode')
      },
    }
  }
})
