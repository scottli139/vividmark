import { Plugin } from '@milkdown/kit/prose/state'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'
import { matchAlertMarkerLine, type GithubAlertType } from '../../lib/markdown/githubAlert'

/**
 * GitHub Alerts（`> [!NOTE]`）WYSIWYG 装饰插件（v1：纯装饰，零 schema 变更）。
 *
 * blockquote 首段首行命中 `[!TYPE]`（五类、大小写不敏感、独占一行）时注入：
 * - NodeDecoration：blockquote 加 `admonition <type> github-alert` class——直接复用
 *   globals.css 的 admonition 亮暗配色（与预览/导出渲染出的 alert 盒视觉一致）；
 * - InlineDecoration：标记文本加 `github-alert-marker`（着色加粗，读作标题行）。
 *
 * 标记行 `[!NOTE]` 保持可见可编辑（用户改成 [!TIP] 即换色、删掉 `]` 即退回普通引用），
 * 文档模型就是源码本身，天然无损往返。折叠标记 +/- 与未知类型不识别（同预览侧口径）。
 */

/** 首段「首行」文本：累加到第一个 hardbreak 为止；行内混入非文本节点（图片/公式）则非独占标记行 */
export function alertTypeOfBlockquote(node: ProseNode): GithubAlertType | null {
  const para = node.firstChild
  if (!para || para.type.name !== 'paragraph') return null

  let firstLine = ''
  let valid = true
  let done = false
  para.forEach((child) => {
    if (done) return
    if (child.type.name === 'hardbreak') {
      done = true
      return
    }
    // 行内混入非文本节点（图片/公式）或带 mark 的文本（`**[!NOTE]**`）→ 非独占标记行。
    // mark 检查对齐预览侧口径：源码行含标记语法字符时 markdown-it 正则同样不匹配
    if (!child.isText || child.marks.length > 0) {
      valid = false
      done = true
      return
    }
    firstLine += child.text ?? ''
  })
  if (!valid || !firstLine) return null
  return matchAlertMarkerLine(firstLine)
}

function collectAlertDecorations(doc: ProseNode): Decoration[] {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') return true
    const type = alertTypeOfBlockquote(node)
    if (!type) return true

    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: `admonition ${type} github-alert`,
      })
    )
    // 标记文本位置：blockquote 起点 +1 进首段、再 +1 进段落内容；长度 = `[!` + 类型名 + `]`
    const markerFrom = pos + 2
    decorations.push(
      Decoration.inline(markerFrom, markerFrom + type.length + 4, {
        class: 'github-alert-marker',
      })
    )
    return true
  })
  return decorations
}

export const githubAlertDecorationPlugin = $prose(() => {
  return new Plugin({
    props: {
      decorations(state) {
        return DecorationSet.create(state.doc, collectAlertDecorations(state.doc))
      },
    },
  })
})
