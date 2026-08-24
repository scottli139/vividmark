import type { MenuItem } from '../components/Menu'
import type { FormatType } from './markdownEditing'

/**
 * 编辑器右键菜单的纯函数构建器（Source / WYSIWYG / Preview 共用）。
 *
 * 结构对齐 Typora：剪贴板组 +「段落 ▸ / 格式 ▸ / 插入 ▸」子菜单
 * （WYSIWYG 另有上下文组排在最前）。
 *
 * 只负责「菜单项长什么样」——id、文案、快捷键标注、disabled、分隔线；
 * 动作执行由各编辑器组件按 id 分发（format:* 转发 editor-format 事件总线，
 * 剪贴板走 lib/clipboard.ts，WYSIWYG 上下文动作走 wysiwygContextMenu.ts）。
 * 纯函数便于 jsdom 单测。
 */

export type TranslateFn = (key: string) => string

/** 行内格式（id 为 format:<FormatType>，点击后转发 editor-format） */
const INLINE_FORMATS: FormatType[] = ['bold', 'italic', 'strike', 'code', 'link']

const FORMAT_LABEL_KEYS: Record<string, string> = {
  bold: 'contextMenu.bold',
  italic: 'contextMenu.italic',
  strike: 'contextMenu.strikethrough',
  code: 'contextMenu.inlineCode',
  link: 'contextMenu.link',
  h1: 'contextMenu.heading1',
  h2: 'contextMenu.heading2',
  h3: 'contextMenu.heading3',
  h4: 'contextMenu.heading4',
  h5: 'contextMenu.heading5',
  h6: 'contextMenu.heading6',
  paragraph: 'contextMenu.normalText',
  quote: 'contextMenu.quote',
  list: 'contextMenu.bulletList',
  ol: 'contextMenu.orderedList',
  tasklist: 'contextMenu.taskList',
  codeblock: 'contextMenu.codeBlock',
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
  heading1: string
  heading2: string
  heading3: string
  heading4: string
  heading5: string
  heading6: string
  paragraph: string
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
      heading1: '⌘1',
      heading2: '⌘2',
      heading3: '⌘3',
      heading4: '⌘4',
      heading5: '⌘5',
      heading6: '⌘6',
      paragraph: '⌘0',
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
    heading1: 'Ctrl+1',
    heading2: 'Ctrl+2',
    heading3: 'Ctrl+3',
    heading4: 'Ctrl+4',
    heading5: 'Ctrl+5',
    heading6: 'Ctrl+6',
    paragraph: 'Ctrl+0',
  }
}

function formatShortcut(format: FormatType, shortcuts: ShortcutLabels): string | undefined {
  switch (format) {
    case 'bold':
      return shortcuts.bold
    case 'italic':
      return shortcuts.italic
    case 'link':
      return shortcuts.link
    case 'h1':
      return shortcuts.heading1
    case 'h2':
      return shortcuts.heading2
    case 'h3':
      return shortcuts.heading3
    case 'h4':
      return shortcuts.heading4
    case 'h5':
      return shortcuts.heading5
    case 'h6':
      return shortcuts.heading6
    case 'paragraph':
      return shortcuts.paragraph
    default:
      return undefined
  }
}

function formatItem(t: TranslateFn, shortcuts: ShortcutLabels, format: FormatType): MenuItem {
  return {
    id: `format:${format}`,
    label: t(FORMAT_LABEL_KEYS[format]),
    shortcut: formatShortcut(format, shortcuts),
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

/** 「格式 ▸」子菜单（Typora 结构）：加粗/斜体/删除线/行内代码/链接 */
function buildFormatSubmenu(t: TranslateFn, shortcuts: ShortcutLabels): MenuItem {
  return {
    id: 'submenu:format',
    label: t('contextMenu.format'),
    children: INLINE_FORMATS.map((format) => formatItem(t, shortcuts, format)),
  }
}

/** 「段落 ▸」子菜单（Typora 结构）：正文 + 标题 1-6 + 引用/列表/任务/代码块（两模式通用） */
function buildParagraphSubmenu(t: TranslateFn, shortcuts: ShortcutLabels): MenuItem {
  return {
    id: 'submenu:paragraph',
    label: t('contextMenu.paragraph'),
    children: [
      formatItem(t, shortcuts, 'paragraph'),
      formatItem(t, shortcuts, 'h1'),
      formatItem(t, shortcuts, 'h2'),
      formatItem(t, shortcuts, 'h3'),
      formatItem(t, shortcuts, 'h4'),
      formatItem(t, shortcuts, 'h5'),
      formatItem(t, shortcuts, 'h6'),
      { divider: true },
      formatItem(t, shortcuts, 'quote'),
      formatItem(t, shortcuts, 'list'),
      formatItem(t, shortcuts, 'ol'),
      formatItem(t, shortcuts, 'tasklist'),
      formatItem(t, shortcuts, 'codeblock'),
    ],
  }
}

/** Source 模式（CodeMirror）右键菜单 */
export function buildSourceMenuItems(
  t: TranslateFn,
  shortcuts: ShortcutLabels,
  state: EditMenuState
): MenuItem[] {
  return [
    ...buildBaseEditItems(t, shortcuts, { ...state, includeFind: true }),
    { divider: true },
    buildParagraphSubmenu(t, shortcuts),
    buildFormatSubmenu(t, shortcuts),
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

/** 「插入 ▸」子菜单（Typora 结构，WYSIWYG 专有）：块插入 + 在上方/下方插入段落 */
function buildInsertSubmenu(t: TranslateFn): MenuItem {
  return {
    id: 'submenu:insert',
    label: t('contextMenu.insert'),
    children: [
      { id: 'insert:image', label: t('contextMenu.insertImage') },
      { id: 'insert:table', label: t('contextMenu.insertTable') },
      { id: 'insert:codeblock', label: t('contextMenu.codeBlock') },
      { id: 'insert:hr', label: t('contextMenu.horizontalRule') },
      { divider: true },
      { id: 'insert:paragraph-above', label: t('contextMenu.insertParagraphAbove') },
      { id: 'insert:paragraph-below', label: t('contextMenu.insertParagraphBelow') },
    ],
  }
}

/** WYSIWYG 上下文感知菜单：上下文组（表格/链接/图片/代码块）+ 基础编辑组 + 段落/格式/插入子菜单 */
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
    { divider: true },
    buildParagraphSubmenu(t, shortcuts),
    buildFormatSubmenu(t, shortcuts),
    buildInsertSubmenu(t),
  ]
}

/** Preview 右键落点的上下文 */
export interface PreviewMenuContext {
  hasSelection: boolean
  /** 菜单打开时刻的选区文本快照：copy 用它而非实时 DOM 选择
   * （WKWebView 下点击菜单项会坍缩 DOM 选择，点击时已读不到原文） */
  selectedText?: string
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
