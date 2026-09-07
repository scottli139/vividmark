import type { MenuItem } from '../components/Menu'
import { getShortcutLabels, type TranslateFn } from './contextMenu'
import { isMacOS } from './platform'
import type { ThemeMode } from './theme'

/**
 * 自绘菜单栏（Windows 桌面端 / 浏览器 dev）的纯函数构建器。
 *
 * 结构对齐 src-tauri/src/menu.rs 的 Windows 布局（File/Edit/Paragraph/Format/
 * View/Window/Help），id 与原生菜单同源（format:* / insert:* / view-mode-* …），
 * 点击统一由 nativeMenu.ts 的 handleMenuAction 分发。
 *
 * 与原生菜单的差异：checked/disabled 直接从 store 状态映射（响应式渲染，
 * 无需 set_menu_item_checked 那套命令式同步）；Open Recent 子菜单由
 * recentFiles 动态生成；剪贴板四项与 About 在原生菜单是系统预定义项，
 * 这里走 editor-cut/copy/paste/select-all 事件与自绘 AboutDialog。
 *
 * 只负责「菜单项长什么样」，纯函数便于 jsdom 单测。
 */

/** 构建菜单栏所需的 store 快照字段 */
export interface MenuBarState {
  viewMode: 'wysiwyg' | 'source' | 'split' | 'preview'
  themeMode: ThemeMode
  sidebarTab: 'files' | 'outline'
  canUndo: boolean
  canRedo: boolean
  filePath: string | null
  openedFolder: string | null
  recentFiles: { name: string; path: string }[]
}

export interface MenuBarMenu {
  id: string
  label: string
  items: MenuItem[]
}

/** contextMenu.getShortcutLabels 未覆盖的菜单栏专属快捷键（与 menu.rs accelerator 对齐） */
function menuShortcuts(isMac: boolean) {
  const mod = isMac ? '⌘' : 'Ctrl+'
  const alt = isMac ? '⌥' : 'Alt+'
  return {
    new: `${mod}N`,
    open: `${mod}O`,
    openFolder: isMac ? `⇧${mod}O` : 'Ctrl+Shift+O',
    save: `${mod}S`,
    saveAs: isMac ? `⇧${mod}S` : 'Ctrl+Shift+S',
    exportPdf: `${mod}P`,
    settings: `${mod},`,
    pastePlain: isMac ? `⇧${mod}V` : 'Ctrl+Shift+V',
    quote: `${mod}${alt}Q`,
    list: `${mod}${alt}U`,
    ol: `${mod}${alt}O`,
    tasklist: `${mod}${alt}X`,
    codeblock: `${mod}${alt}C`,
    sidebar: isMac ? `⇧${mod}B` : 'Ctrl+Shift+B',
    modeWysiwyg: `${mod}${alt}1`,
    modeSource: `${mod}${alt}2`,
    modeSplit: `${mod}${alt}3`,
    modePreview: `${mod}${alt}4`,
    zoomIn: `${mod}=`,
    zoomOut: `${mod}-`,
    zoomReset: isMac ? `⇧${mod}0` : 'Ctrl+Shift+0',
    fullscreen: 'F11',
  }
}

/** Open Recent 子菜单：动态生成，空列表时禁用占位；末尾固定「清空」 */
function buildRecentSubmenu(t: TranslateFn, state: MenuBarState): MenuItem {
  const children: MenuItem[] =
    state.recentFiles.length === 0
      ? [{ id: 'open-recent-empty', label: t('menu.noRecentFiles'), disabled: true }]
      : state.recentFiles.map((f) => ({ id: `open-recent:${f.path}`, label: f.name }))
  children.push({ divider: true })
  children.push({
    id: 'clear-recent',
    label: t('menu.clearRecent'),
    disabled: state.recentFiles.length === 0,
  })
  return { id: 'open-recent', label: t('menu.openRecent'), children }
}

export function buildMenuBarMenus(t: TranslateFn, state: MenuBarState): MenuBarMenu[] {
  const isMac = isMacOS()
  const sc = getShortcutLabels(isMac)
  const ms = menuShortcuts(isMac)

  const file: MenuBarMenu = {
    id: 'file',
    label: t('menu.file'),
    items: [
      { id: 'file-new', label: t('menu.new'), shortcut: ms.new },
      { id: 'file-open', label: t('menu.open'), shortcut: ms.open },
      buildRecentSubmenu(t, state),
      { divider: true },
      { id: 'file-open-folder', label: t('menu.openFolder'), shortcut: ms.openFolder },
      {
        id: 'file-reveal',
        label: isMac ? t('fileTree.revealFinder') : t('fileTree.revealFileManager'),
        disabled: state.filePath === null,
      },
      { divider: true },
      { id: 'file-save', label: t('menu.save'), shortcut: ms.save },
      { id: 'file-save-as', label: t('menu.saveAs'), shortcut: ms.saveAs },
      { divider: true },
      { id: 'export-pdf', label: t('menu.exportPdf'), shortcut: ms.exportPdf },
      { id: 'export-site', label: t('menu.exportSite'), disabled: state.openedFolder === null },
      { divider: true },
      { id: 'settings', label: t('menu.settings'), shortcut: ms.settings },
      { divider: true },
      { id: 'file:exit', label: t('menu.exit') },
    ],
  }

  const edit: MenuBarMenu = {
    id: 'edit',
    label: t('menu.edit'),
    items: [
      {
        id: 'edit-undo',
        label: t('contextMenu.undo'),
        shortcut: sc.undo,
        disabled: !state.canUndo,
      },
      {
        id: 'edit-redo',
        label: t('contextMenu.redo'),
        shortcut: sc.redo,
        disabled: !state.canRedo,
      },
      { divider: true },
      { id: 'edit-cut', label: t('contextMenu.cut'), shortcut: sc.cut },
      { id: 'edit-copy', label: t('contextMenu.copy'), shortcut: sc.copy },
      { id: 'edit-paste', label: t('contextMenu.paste'), shortcut: sc.paste },
      { id: 'edit-paste-plain', label: t('menu.pastePlain'), shortcut: ms.pastePlain },
      { id: 'edit-select-all', label: t('contextMenu.selectAll'), shortcut: sc.selectAll },
      { divider: true },
      { id: 'edit-find', label: t('menu.find'), shortcut: sc.find },
    ],
  }

  const paragraph: MenuBarMenu = {
    id: 'paragraph',
    label: t('menu.paragraph'),
    items: [
      { id: 'format:h1', label: t('contextMenu.heading1'), shortcut: sc.heading1 },
      { id: 'format:h2', label: t('contextMenu.heading2'), shortcut: sc.heading2 },
      { id: 'format:h3', label: t('contextMenu.heading3'), shortcut: sc.heading3 },
      { id: 'format:h4', label: t('contextMenu.heading4'), shortcut: sc.heading4 },
      { id: 'format:h5', label: t('contextMenu.heading5'), shortcut: sc.heading5 },
      { id: 'format:h6', label: t('contextMenu.heading6'), shortcut: sc.heading6 },
      { id: 'format:paragraph', label: t('contextMenu.normalText'), shortcut: sc.paragraph },
      { divider: true },
      { id: 'format:quote', label: t('contextMenu.quote'), shortcut: ms.quote },
      { id: 'format:list', label: t('contextMenu.bulletList'), shortcut: ms.list },
      { id: 'format:ol', label: t('contextMenu.orderedList'), shortcut: ms.ol },
      { id: 'format:tasklist', label: t('contextMenu.taskList'), shortcut: ms.tasklist },
      { id: 'format:codeblock', label: t('contextMenu.codeBlock'), shortcut: ms.codeblock },
      { divider: true },
      { id: 'insert:hr', label: t('contextMenu.horizontalRule') },
      { id: 'insert:table', label: t('menu.table') },
      { id: 'insert:image', label: t('menu.image') },
      { id: 'insert:admonition', label: t('menu.admonition') },
    ],
  }

  const format: MenuBarMenu = {
    id: 'format',
    label: t('menu.format'),
    items: [
      { id: 'format:bold', label: t('contextMenu.bold'), shortcut: sc.bold },
      { id: 'format:italic', label: t('contextMenu.italic'), shortcut: sc.italic },
      { id: 'format:strike', label: t('contextMenu.strikethrough') },
      { id: 'format:code', label: t('contextMenu.inlineCode') },
      { divider: true },
      { id: 'format:link', label: t('contextMenu.link'), shortcut: sc.link },
      { id: 'insert:image', label: t('menu.image') },
    ],
  }

  const view: MenuBarMenu = {
    id: 'view',
    label: t('menu.view'),
    items: [
      { id: 'view-sidebar', label: t('settings.sidebar'), shortcut: ms.sidebar },
      {
        id: 'view-sidebar-files',
        label: t('sidebar.files'),
        checked: state.sidebarTab === 'files',
      },
      {
        id: 'view-sidebar-outline',
        label: t('sidebar.outline'),
        checked: state.sidebarTab === 'outline',
      },
      { divider: true },
      {
        id: 'view-mode-wysiwyg',
        label: t('toolbar.viewMode.wysiwyg'),
        shortcut: ms.modeWysiwyg,
        checked: state.viewMode === 'wysiwyg',
      },
      {
        id: 'view-mode-source',
        label: t('toolbar.viewMode.source'),
        shortcut: ms.modeSource,
        checked: state.viewMode === 'source',
      },
      {
        id: 'view-mode-split',
        label: t('toolbar.viewMode.split'),
        shortcut: ms.modeSplit,
        checked: state.viewMode === 'split',
      },
      {
        id: 'view-mode-preview',
        label: t('toolbar.viewMode.preview'),
        shortcut: ms.modePreview,
        checked: state.viewMode === 'preview',
      },
      { divider: true },
      { id: 'zoom-in', label: t('menu.zoomIn'), shortcut: ms.zoomIn },
      { id: 'zoom-out', label: t('menu.zoomOut'), shortcut: ms.zoomOut },
      { id: 'zoom-reset', label: t('menu.zoomReset'), shortcut: ms.zoomReset },
      { divider: true },
      {
        id: 'theme',
        label: t('menu.theme'),
        children: [
          {
            id: 'theme-light',
            label: t('settings.theme.light'),
            checked: state.themeMode === 'light',
          },
          {
            id: 'theme-dark',
            label: t('settings.theme.dark'),
            checked: state.themeMode === 'dark',
          },
          {
            id: 'theme-system',
            label: t('settings.theme.system'),
            checked: state.themeMode === 'system',
          },
        ],
      },
      { divider: true },
      { id: 'view:fullscreen', label: t('menu.fullscreen'), shortcut: ms.fullscreen },
    ],
  }

  const windowMenu: MenuBarMenu = {
    id: 'window',
    label: t('menu.window'),
    items: [
      { id: 'window:minimize', label: t('toolbar.tooltip.minimize') },
      { id: 'window:maximize', label: t('toolbar.tooltip.maximize') },
    ],
  }

  const help: MenuBarMenu = {
    id: 'help',
    label: t('menu.help'),
    items: [{ id: 'help-about', label: t('menu.about') }],
  }

  return [file, edit, paragraph, format, view, windowMenu, help]
}
