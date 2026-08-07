import type { Ctx } from '@milkdown/kit/ctx'
import { editorViewCtx } from '@milkdown/kit/core'
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
} from '@milkdown/kit/preset/gfm'
import { AllSelection, Selection, TextSelection } from '@milkdown/kit/prose/state'
import type { Node as ProseNode, ResolvedPos } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'
import { callCommand } from '@milkdown/kit/utils'
import type { WysiwygMenuContext } from '../../lib/contextMenu'
import { readClipboardText, writeClipboardText } from '../../lib/clipboard'
import { insertWysiwygSnippet } from './wysiwygFormat'

/**
 * WYSIWYG 右键菜单的上下文解析与上下文动作执行。
 *
 * 菜单项构建是纯函数（lib/contextMenu.ts）；本模块负责：
 * - resolveWysiwygContext：从 PM 选区推导上下文（表格/链接/图片/代码块）
 * - applyWysiwygContextAction：执行上下文动作（行列增删、链接移除、图片删除、
 *   复制代码、剪贴板粘贴等需要 PM/异步能力的部分）
 *
 * 表格行/列删除直接构造 PM transaction（不依赖 milkdown selectRow/deleteSelectedCells
 * 的内部 index 语义）；行/列新增复用 milkdown gfm 命令（作用于当前选区）。
 */

function hasAncestorOfType($pos: ResolvedPos, ...names: string[]): boolean {
  for (let d = $pos.depth; d > 0; d--) {
    if (names.includes($pos.node(d).type.name)) return true
  }
  return false
}

/** 光标所在行节点深度（table_row / table_header_row）与表格深度；不在表格内返回 -1 */
function findTableDepths($pos: ResolvedPos): { rowDepth: number; tableDepth: number } {
  let rowDepth = -1
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name
    if ((name === 'table_row' || name === 'table_header_row') && rowDepth < 0) {
      rowDepth = d
    }
    if (name === 'table') {
      return { rowDepth, tableDepth: d }
    }
  }
  return { rowDepth: -1, tableDepth: -1 }
}

/** 选区落点的链接 mark 范围（跨相邻同 mark 文本节点扩展）；无链接返回 null */
function getLinkRange(view: EditorView): { from: number; to: number; href: string } | null {
  const linkType = view.state.schema.marks.link
  if (!linkType) return null
  const { $from } = view.state.selection
  const parent = $from.parent
  const parentStart = $from.start()
  const offset = $from.pos - parentStart

  const children: { node: ProseNode; start: number; end: number }[] = []
  let pos = 0
  parent.forEach((child) => {
    children.push({ node: child, start: pos, end: pos + child.nodeSize })
    pos += child.nodeSize
  })

  // 光标落在节点内，或紧贴其右边界（posAtCoords 命中文字时 pos 在节点内部）
  const hit = children.findIndex(
    (c) => c.node.marks.some((m) => m.type === linkType) && offset > c.start && offset <= c.end
  )
  if (hit < 0) return null
  const mark = children[hit].node.marks.find((m) => m.type === linkType)!

  let first = hit
  while (first > 0 && mark.isInSet(children[first - 1].node.marks)) first--
  let last = hit
  while (last < children.length - 1 && mark.isInSet(children[last + 1].node.marks)) last++

  return {
    from: parentStart + children[first].start,
    to: parentStart + children[last].end,
    href: (mark.attrs.href as string) ?? '',
  }
}

/** 从当前选区推导右键菜单上下文（调用方已把光标落到右键位置） */
export function resolveWysiwygContext(view: EditorView): WysiwygMenuContext {
  const { state } = view
  const { $from } = state.selection
  const { tableDepth } = findTableDepths($from)
  const linkRange = getLinkRange(view)
  return {
    inTable: tableDepth >= 0,
    inTableHeader: hasAncestorOfType($from, 'table_header_row'),
    linkHref: linkRange?.href,
    onImage: $from.nodeBefore?.type.name === 'image' || $from.nodeAfter?.type.name === 'image',
    inCodeBlock: $from.parent.type.name === 'code_block',
  }
}

/** 删除光标所在表格行（表头行不允许——markdown 表格必须有表头） */
function deleteTableRow(view: EditorView): boolean {
  const { state } = view
  const { $from } = state.selection
  const { rowDepth, tableDepth } = findTableDepths($from)
  if (rowDepth < 0 || tableDepth < 0) return false
  if ($from.node(rowDepth).type.name === 'table_header_row') return false

  const table = $from.node(tableDepth)
  const rowIndex = $from.index(tableDepth)
  let rowPos = $from.before(tableDepth) + 1
  for (let i = 0; i < rowIndex; i++) rowPos += table.child(i).nodeSize
  const row = table.child(rowIndex)

  const tr = state.tr.delete(rowPos, rowPos + row.nodeSize)
  view.dispatch(
    tr
      .setSelection(Selection.near(tr.doc.resolve(Math.min(rowPos, tr.doc.content.size))))
      .scrollIntoView()
  )
  return true
}

/** 删除光标所在表格列；仅剩一列时删除整表 */
function deleteTableCol(view: EditorView): boolean {
  const { state } = view
  const { $from } = state.selection
  const { rowDepth, tableDepth } = findTableDepths($from)
  if (rowDepth < 0 || tableDepth < 0) return false

  const table = $from.node(tableDepth)
  const tablePos = $from.before(tableDepth)
  const cellIndex = $from.index(rowDepth)

  if (table.child(0).childCount <= 1) {
    return deleteTable(view)
  }

  // 收集每行目标列的删除区间，从后往前删保证位置有效
  const ranges: [number, number][] = []
  let rowPos = tablePos + 1
  table.forEach((row) => {
    const cell = row.child(cellIndex)
    if (cell) {
      let cellPos = rowPos + 1
      for (let i = 0; i < cellIndex; i++) cellPos += row.child(i).nodeSize
      ranges.push([cellPos, cellPos + cell.nodeSize])
    }
    rowPos += row.nodeSize
  })

  const tr = state.tr
  for (let i = ranges.length - 1; i >= 0; i--) {
    tr.delete(ranges[i][0], ranges[i][1])
  }
  const anchor = Math.min(ranges[0][0], tr.doc.content.size)
  view.dispatch(tr.setSelection(Selection.near(tr.doc.resolve(anchor))).scrollIntoView())
  return true
}

/** 删除整个表格 */
function deleteTable(view: EditorView): boolean {
  const { state } = view
  const { $from } = state.selection
  const { tableDepth } = findTableDepths($from)
  if (tableDepth < 0) return false

  const tablePos = $from.before(tableDepth)
  const table = $from.node(tableDepth)
  const tr = state.tr.delete(tablePos, tablePos + table.nodeSize)
  view.dispatch(
    tr
      .setSelection(Selection.near(tr.doc.resolve(Math.min(tablePos, tr.doc.content.size))))
      .scrollIntoView()
  )
  return true
}

/** 移除光标所在链接（保留链接文本） */
function removeLink(view: EditorView): boolean {
  const range = getLinkRange(view)
  if (!range) return false
  const linkType = view.state.schema.marks.link
  const tr = view.state.tr.removeMark(range.from, range.to, linkType)
  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, range.from)).scrollIntoView())
  return true
}

/** 删除光标相邻的图片节点（右键图片时 posAtCoords 落在图片前后） */
function deleteImage(view: EditorView): boolean {
  const { state } = view
  const { $from } = state.selection
  if ($from.nodeBefore?.type.name === 'image') {
    const pos = $from.pos - $from.nodeBefore.nodeSize
    view.dispatch(state.tr.delete(pos, $from.pos).scrollIntoView())
    return true
  }
  if ($from.nodeAfter?.type.name === 'image') {
    view.dispatch(state.tr.delete($from.pos, $from.pos + $from.nodeAfter.nodeSize).scrollIntoView())
    return true
  }
  return false
}

/**
 * 执行右键菜单动作（WYSIWYG 侧）。返回 true 表示已处理；
 * format:* 与 undo/redo 等由调用方走既有通道，这里不处理（返回 false）。
 */
export function applyWysiwygContextAction(ctx: Ctx, id: string): boolean {
  const view = ctx.get(editorViewCtx)

  switch (id) {
    // 表格：新增行列走 milkdown gfm 命令（作用于当前选区）
    case 'table:add-row-before':
      callCommand(addRowBeforeCommand.key)(ctx)
      return true
    case 'table:add-row-after':
      callCommand(addRowAfterCommand.key)(ctx)
      return true
    case 'table:add-col-before':
      callCommand(addColBeforeCommand.key)(ctx)
      return true
    case 'table:add-col-after':
      callCommand(addColAfterCommand.key)(ctx)
      return true
    case 'table:delete-row':
      return deleteTableRow(view)
    case 'table:delete-col':
      return deleteTableCol(view)
    case 'table:delete-table':
      return deleteTable(view)

    case 'link:remove':
      return removeLink(view)
    // link:open / link:copy 只需 href（菜单数据快照），由组件层处理

    case 'image:delete':
      return deleteImage(view)

    case 'codeblock:copy':
      if (view.state.selection.$from.parent.type.name !== 'code_block') return false
      void writeClipboardText(view.state.selection.$from.parent.textContent)
      return true

    // 剪贴板：copy/cut 序列化为纯文本（保留格式的剪贴板序列化是已知限制）；
    // paste 读系统剪贴板按 markdown 解析插入
    case 'copy': {
      const { from, to, empty } = view.state.selection
      if (empty) return false
      void writeClipboardText(view.state.doc.textBetween(from, to, '\n', '\n'))
      return true
    }
    case 'cut': {
      const { from, to, empty } = view.state.selection
      if (empty) return false
      void writeClipboardText(view.state.doc.textBetween(from, to, '\n', '\n'))
      view.dispatch(view.state.tr.deleteSelection().scrollIntoView())
      return true
    }
    case 'paste': {
      void readClipboardText().then((text) => {
        if (!text) return
        // 与 Milkdown 原生粘贴一致：剪贴板文本按 markdown 解析插入；
        // 解析失败（异常输入）回退为纯文本插入
        try {
          insertWysiwygSnippet(ctx, text)
        } catch {
          const { state } = view
          view.dispatch(state.tr.insertText(text, state.selection.from, state.selection.to))
        }
      })
      return true
    }
    case 'select-all': {
      const { state } = view
      view.dispatch(state.tr.setSelection(new AllSelection(state.doc)))
      return true
    }
    default:
      return false
  }
}
