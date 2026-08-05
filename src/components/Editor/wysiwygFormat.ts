import type { Ctx } from '@milkdown/kit/ctx'
import { editorViewCtx } from '@milkdown/kit/core'
import {
  createCodeBlockCommand,
  linkSchema,
  listItemSchema,
  paragraphSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { lift, setBlockType } from '@milkdown/kit/prose/commands'
import type { Node as ProseNode, ResolvedPos } from '@milkdown/kit/prose/model'
import { liftListItem, wrapInList } from '@milkdown/kit/prose/schema-list'
import { TextSelection } from '@milkdown/kit/prose/state'
import { callCommand, insert } from '@milkdown/kit/utils'
import type { FormatType } from '../../lib/markdownEditing'

/**
 * WYSIWYG（Milkdown/PM）侧的工具栏 format/insert 实现
 *
 * 与 source 模式（lib/markdownEditing.ts）行为对齐：
 * - 行内格式 toggleMark；无选区时 link 插入占位链接并选中占位文本
 * - h1/h2/h3：已是同级标题则回到段落（toggle）
 * - quote/list/tasklist：已在对应结构中则还原/提升，否则包裹（toggle）
 */

function hasAncestorOfType($pos: ResolvedPos, name: string): boolean {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === name) return true
  }
  return false
}

/** 链接：有选区 toggle link mark（href=url 占位）；无选区插入占位链接并选中占位文本 */
function applyLink(ctx: Ctx) {
  const view = ctx.get(editorViewCtx)
  const { state } = view

  if (!state.selection.empty) {
    callCommand(toggleLinkCommand.key, { href: 'url' })(ctx)
    return
  }

  const linkType = linkSchema.type(ctx)
  const placeholder = 'link text'
  const from = state.selection.from
  const textNode = state.schema.text(placeholder, [linkType.create({ href: 'url' })])
  const tr = state.tr.replaceSelectionWith(textNode, false)
  tr.setSelection(TextSelection.create(tr.doc, from, from + placeholder.length))
  view.dispatch(tr.scrollIntoView())
}

/** 标题 toggle：已是同级标题 → 段落；否则设置对应级别 */
function applyHeading(ctx: Ctx, level: number) {
  const view = ctx.get(editorViewCtx)
  const parent = view.state.selection.$from.parent
  if (parent.type.name === 'heading' && parent.attrs.level === level) {
    callCommand(wrapInHeadingCommand.key, 0)(ctx)
  } else {
    callCommand(wrapInHeadingCommand.key, level)(ctx)
  }
}

/** 引用 toggle：已在 blockquote 内 → lift 出来；否则包裹 */
function applyQuote(ctx: Ctx) {
  const view = ctx.get(editorViewCtx)
  if (hasAncestorOfType(view.state.selection.$from, 'blockquote')) {
    lift(view.state, view.dispatch)
  } else {
    callCommand(wrapInBlockquoteCommand.key)(ctx)
  }
}

/** 列表 toggle（bullet/ordered）：已在对应列表内 → liftListItem 还原；否则包裹 */
function applyList(ctx: Ctx, ordered: boolean) {
  const view = ctx.get(editorViewCtx)
  const listName = ordered ? 'ordered_list' : 'bullet_list'
  if (hasAncestorOfType(view.state.selection.$from, listName)) {
    liftListItem(listItemSchema.type(ctx))(view.state, view.dispatch)
  } else if (ordered) {
    callCommand(wrapInOrderedListCommand.key)(ctx)
  } else {
    callCommand(wrapInBulletListCommand.key)(ctx)
  }
}

/** 任务列表 toggle：已有任务项 → 取消任务；普通列表 → 转任务；否则包裹为任务列表 */
function applyTaskList(ctx: Ctx) {
  const view = ctx.get(editorViewCtx)
  const { state } = view
  const { from, to } = state.selection

  const listItems: { node: ProseNode; pos: number }[] = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'list_item') listItems.push({ node, pos })
  })

  const isTask = (node: ProseNode) =>
    node.attrs.checked !== null && node.attrs.checked !== undefined

  if (listItems.some((item) => isTask(item.node))) {
    // 已有任务项 → 全部取消任务标记
    const tr = state.tr
    listItems.forEach(({ node, pos }) => {
      if (isTask(node)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: null })
    })
    view.dispatch(tr.scrollIntoView())
    return
  }

  if (listItems.length > 0) {
    // 普通列表 → 全部转为任务项
    const tr = state.tr
    listItems.forEach(({ node, pos }) => {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: false })
    })
    view.dispatch(tr.scrollIntoView())
    return
  }

  // 非列表 → 包裹为任务列表
  wrapInList(listItemSchema.type(ctx), { checked: false })(state, view.dispatch)
}

/** 代码块 toggle：已在代码块 → 段落；否则转为代码块 */
function applyCodeBlock(ctx: Ctx) {
  const view = ctx.get(editorViewCtx)
  const parent = view.state.selection.$from.parent
  if (parent.type.name === 'code_block') {
    setBlockType(paragraphSchema.type(ctx))(view.state, view.dispatch)
  } else {
    callCommand(createCodeBlockCommand.key)(ctx)
  }
}

/** 工具栏 editor-format 事件入口（调用方已做 viewMode 分流） */
export function applyWysiwygFormat(ctx: Ctx, format: FormatType) {
  switch (format) {
    case 'bold':
      callCommand(toggleStrongCommand.key)(ctx)
      break
    case 'italic':
      callCommand(toggleEmphasisCommand.key)(ctx)
      break
    case 'strike':
      callCommand(toggleStrikethroughCommand.key)(ctx)
      break
    case 'code':
      callCommand(toggleInlineCodeCommand.key)(ctx)
      break
    case 'link':
      applyLink(ctx)
      break
    case 'image':
      // 图片是 atom 节点：插入占位图片节点（无「选中占位文本」概念）
      insertWysiwygSnippet(ctx, '![alt text](image-url)')
      break
    case 'h1':
      applyHeading(ctx, 1)
      break
    case 'h2':
      applyHeading(ctx, 2)
      break
    case 'h3':
      applyHeading(ctx, 3)
      break
    case 'quote':
      applyQuote(ctx)
      break
    case 'list':
      applyList(ctx, false)
      break
    case 'tasklist':
      applyTaskList(ctx)
      break
    case 'codeblock':
      applyCodeBlock(ctx)
      break
  }
}

/**
 * 工具栏 editor-insert 事件入口：把 markdown 片段解析为 PM 节点插入选区
 * （图片/表格/代码块都不会退化成纯文本）。插入后光标修正：
 * 表格 → 首单元格；代码块 → 块内。
 */
export function insertWysiwygSnippet(ctx: Ctx, markdown: string) {
  insert(markdown)(ctx)

  const view = ctx.get(editorViewCtx)
  const { state } = view
  const $from = state.selection.$from
  const before = $from.nodeBefore
  if (!before) return

  if (before.type.name === 'table' || before.type.name === 'code_block') {
    const blockStart = state.selection.from - before.nodeSize
    const $pos = state.doc.resolve(blockStart + 1)
    view.dispatch(state.tr.setSelection(TextSelection.near($pos, 1)).scrollIntoView())
  }
}
