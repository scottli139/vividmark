import { Plugin } from '@milkdown/kit/prose/state'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { $prose } from '@milkdown/kit/utils'

/**
 * 脚注 WYSIWYG 装饰插件（节点 schema 由 Milkdown gfm 预设自带：
 * `footnote_reference` 行内 atom / `footnote_definition` 块节点，往返由
 * remark-gfm 的 micromark/mdast 扩展保证，本插件只做视图层编号）。
 *
 * 编号口径与预览侧 markdown-it-footnote 对齐：按「引用在文档中的首次出现
 * 顺序」从 1 编号，同一定义的多次引用共享同一序号。编号经 NodeDecoration
 * 写入 `data-footnote-number`，CSS 负责把 label 文本替换为 [N] 显示。
 *
 * 悬空引用（定义被用户在编辑器里删掉）不编号——label 原文继续显示，
 * 对应预览侧「无定义的 `[^x]` 渲染为字面文本」的降级口径。
 */

/** 收集全文档 footnote_definition 的 label 集合 */
function collectDefinitionLabels(doc: ProseNode): Set<string> {
  const labels = new Set<string>()
  doc.descendants((node) => {
    if (node.type.name === 'footnote_definition') {
      labels.add(String(node.attrs.label))
    }
    return true
  })
  return labels
}

function collectFootnoteDecorations(doc: ProseNode): Decoration[] {
  const definitionLabels = collectDefinitionLabels(doc)
  const decorations: Decoration[] = []
  /** label → 序号（首次出现时分配） */
  const numbers = new Map<string, number>()

  doc.descendants((node, pos) => {
    if (node.type.name !== 'footnote_reference') return true
    const label = String(node.attrs.label)
    // 悬空引用：不编号（保持 label 原文显示，与预览字面文本降级一致）
    if (!definitionLabels.has(label)) return true

    let number = numbers.get(label)
    if (number === undefined) {
      number = numbers.size + 1
      numbers.set(label, number)
    }
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        'data-footnote-number': String(number),
      })
    )
    return true
  })
  return decorations
}

export const footnoteDecorationPlugin = $prose(() => {
  return new Plugin({
    props: {
      decorations(state) {
        return DecorationSet.create(state.doc, collectFootnoteDecorations(state.doc))
      },
    },
  })
})
