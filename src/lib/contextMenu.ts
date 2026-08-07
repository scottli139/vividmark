import type { MenuItem } from '../components/Menu'
import type { FormatType } from './markdownEditing'

/**
 * 编辑器右键菜单的纯函数构建器（Source / WYSIWYG / Preview 共用）。
 *
 * 只负责「菜单项长什么样」——id、文案、快捷键标注、disabled、分隔线；
 * 动作执行由各编辑器组件按 id 分发（format:* 转发 editor-format 事件总线，
 * 剪贴板走 lib/clipboard.ts，WYSIWYG 上下文动作走 wysiwygContextMenu.ts）。
 * 纯函数便于 jsdom 单测。
 */

export type TranslateFn = (key: string) => string

/** 行内格式菜单项（id 为 format:<FormatType>，点击后转发 editor-format） */
const INLINE_FORMATS: FormatType[] = ['bold', 'italic', 'strike', 'code', 'link']

const FORMAT_LABEL_KEYS: Record<string, string> = {
  bold: 'contextMenu.bold',
  italic: 'contextMenu.italic',
  strike: 'contextMenu.strikethrough',
  code: 'contextMenu.inlineCode',
  link: 'contextMenu.link',
}

/** 快捷键标注（仅展示；桌面端带 accelerator 的键由原生菜单/OS 处理） */
export interface ShortcutLabels {
  undo: string
  redo: string
  cut: string
  copy: string
  paste: string
  selectAll: string
  find: string
  bold: string
  italic: string
  link: string
}

export function getShortcutLabels(isMac: boolean): ShortcutLabels {
  if (isMac) {
    return {
      undo: '⌘Z',
      redo: '⇧⌘Z',
      cut: '⌘X',
      copy: '⌘C',
      paste: '⌘V',
      selectAll: '⌘A',
      find: '⌘F',
      bold: '⌘B',
      italic: '⌘I',
      link: '⌘K',
    }
  }
  return {
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Shift+Z',
    cut: 'Ctrl+X',
    copy: 'Ctrl+C',
    paste: 'Ctrl+V',
    selectAll: 'Ctrl+A',
    find: 'Ctrl+F',
    bold: 'Ctrl+B',
    italic: 'Ctrl+I',
    link: 'Ctrl+K',
  }
}

/** 基础编辑项的可用状态（构建时刻从编辑器/存储快照读取） */
export interface EditMenuState {
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  /** WYSIWYG 无查找面板（已知限制），传 false 省略查找项 */
  includeFind?: boolean
}

/** 基础编辑组：撤销/重做 — 剪切/复制/粘贴 — 全选[/查找] */
export function buildBaseEditItems(
  t: TranslateFn,
  shortcuts: ShortcutLabels,
  state: EditMenuState
): MenuItem[] {
  return [
    {
      id: 'undo',
      label: t('contextMenu.undo'),
      shortcut: shortcuts.undo,
      disabled: !state.canUndo,
    },
    {
      id: 'redo',
      label: t('contextMenu.redo'),
      shortcut: shortcuts.redo,
      disabled: !state.canRedo,
    },
    { divider: true },
    {
      id: 'cut',
      label: t('contextMenu.cut'),
      shortcut: shortcuts.cut,
      disabled: !state.hasSelection,
    },
    {
      id: 'copy',
      label: t('contextMenu.copy'),
      shortcut: shortcuts.copy,
      disabled: !state.hasSelection,
    },
    { id: 'paste', label: t('contextMenu.paste'), shortcut: shortcuts.paste },
    { divider: true },
    { id: 'select-all', label: t('contextMenu.selectAll'), shortcut: shortcuts.selectAll },
    ...(state.includeFind
      ? [{ id: 'find', label: t('contextMenu.find'), shortcut: shortcuts.find }]
      : []),
  ]
}

/** 行内格式组（前置分隔线）：加粗/斜体/删除线/行内代码/链接 */
export function buildFormatItems(t: TranslateFn, shortcuts: ShortcutLabels): MenuItem[] {
  const shortcutOf = (format: FormatType): string | undefined => {
    if (format === 'bold') return shortcuts.bold
    if (format === 'italic') return shortcuts.italic
    if (format === 'link') return shortcuts.link
    return undefined
  }
  return [
    { divider: true },
    ...INLINE_FORMATS.map((format) => ({
      id: `format:${format}`,
      label: t(FORMAT_LABEL_KEYS[format]),
      shortcut: shortcutOf(format),
    })),
  ]
}

/** Source 模式（CodeMirror）右键菜单 */
export function buildSourceMenuItems(
  t: TranslateFn,
  shortcuts: ShortcutLabels,
  state: EditMenuState
): MenuItem[] {
  return [
    ...buildBaseEditItems(t, shortcuts, { ...state, includeFind: true }),
    ...buildFormatItems(t, shortcuts),
  ]
}

/** WYSIWYG 右键落点的上下文（由 wysiwygContextMenu.resolveWysiwygContext 提供） */
export interface WysiwygMenuContext {
  inTable: boolean
  /** 落点在表头行（markdown 表格必须有表头 → 禁用删除行） */
  inTableHeader?: boolean
  /** 落点在链接 mark 上时为 href */
  linkHref?: string
  onImage: boolean
  inCodeBlock: boolean
}

/** WYSIWYG 上下文感知菜单：上下文组（表格/链接/图片/代码块）+ 基础编辑组 + 格式组 */
export function buildWysiwygMenuItems(
  t: TranslateFn,
  shortcuts: ShortcutLabels,
  state: EditMenuState,
  context: WysiwygMenuContext
): MenuItem[] {
  const contextItems: MenuItem[] = []

  if (context.inTable) {
    contextItems.push(
      { id: 'table:add-row-before', label: t('contextMenu.addRowAbove') },
      { id: 'table:add-row-after', label: t('contextMenu.addRowBelow') },
      { id: 'table:add-col-before', label: t('contextMenu.addColumnLeft') },
      { id: 'table:add-col-after', label: t('contextMenu.addColumnRight') },
      { divider: true },
      {
        id: 'table:delete-row',
        label: t('contextMenu.deleteRow'),
        disabled: context.inTableHeader === true,
      },
      { id: 'table:delete-col', label: t('contextMenu.deleteColumn') },
      { id: 'table:delete-table', label: t('contextMenu.deleteTable') },
      { divider: true }
    )
  }

  if (context.linkHref !== undefined) {
    contextItems.push(
      { id: 'link:open', label: t('contextMenu.openLink') },
      { id: 'link:copy', label: t('contextMenu.copyLink') },
      { id: 'link:remove', label: t('contextMenu.removeLink') },
      { divider: true }
    )
  }

  if (context.onImage) {
    contextItems.push(
      { id: 'image:delete', label: t('contextMenu.deleteImage') },
      { divider: true }
    )
  }

  if (context.inCodeBlock) {
    contextItems.push({ id: 'codeblock:copy', label: t('contextMenu.copyCode') }, { divider: true })
  }

  // 去掉可能多余的尾部分隔线后，再接基础组（上下文组与基础组之间恰好一条分隔线）
  while (contextItems.length > 0 && 'divider' in contextItems[contextItems.length - 1]) {
    contextItems.pop()
  }

  return [
    ...contextItems,
    ...(contextItems.length > 0 ? [{ divider: true } as MenuItem] : []),
    ...buildBaseEditItems(t, shortcuts, { ...state, includeFind: false }),
    ...buildFormatItems(t, shortcuts),
  ]
}

/** Preview 右键落点的上下文 */
export interface PreviewMenuContext {
  hasSelection: boolean
  /** 落点在 <a> 上时为 href */
  linkHref?: string
  /** 落点在 <img> 上时为 src */
  imageSrc?: string
}

/** Preview 模式右键菜单：链接/图片上下文 + 复制/全选 + 导出 PDF */
export function buildPreviewMenuItems(
  t: TranslateFn,
  shortcuts: ShortcutLabels,
  context: PreviewMenuContext
): MenuItem[] {
  const contextItems: MenuItem[] = []

  if (context.linkHref !== undefined) {
    contextItems.push(
      { id: 'link:open', label: t('contextMenu.openLink') },
      { id: 'link:copy', label: t('contextMenu.copyLink') }
    )
  }
  if (context.imageSrc !== undefined) {
    contextItems.push({ id: 'image:copy-src', label: t('contextMenu.copyImageAddress') })
  }

  return [
    ...contextItems,
    ...(contextItems.length > 0 ? [{ divider: true } as MenuItem] : []),
    {
      id: 'copy',
      label: t('contextMenu.copy'),
      shortcut: shortcuts.copy,
      disabled: !context.hasSelection,
    },
    { id: 'select-all', label: t('contextMenu.selectAll'), shortcut: shortcuts.selectAll },
    { divider: true },
    { id: 'export-pdf', label: t('contextMenu.exportPdf') },
  ]
}
