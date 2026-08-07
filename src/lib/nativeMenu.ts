import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import i18n from '../i18n'
import { useEditorStore, type EditorState } from '../stores/editorStore'
import type { ThemeMode } from './theme'
import { confirmDialog } from './dialog'
import { newFile, openFile, openFileByPath, saveFile, saveFileAs } from './fileOps'
import { isTauri } from './imageSrc'
import { createLogger } from './logger'
import type { FormatType } from './markdownEditing'
import { insertImageFromPicker, openFolderFromPicker } from './editorActions'
import { revealInFolder } from './fileTreeUtils'
import { readClipboardText } from './clipboard'

const logger = createLogger('NativeMenu')

/**
 * 系统原生菜单（src-tauri/src/menu.rs）的前端对接。
 *
 * 事件流：菜单点击 → Rust on_menu_event → emit("native-menu-event", id)
 * → handleMenuAction 分发到现有动作（fileOps / store / editor-* 事件总线）。
 * 带 accelerator 的键在桌面端被 OS 拦截，不走 useKeyboardShortcuts。
 *
 * id 约定（与编辑器右键菜单同源）：
 * - format:<FormatType> → editor-format 事件总线（段落/格式菜单）
 * - insert:image → 图片选择器；insert:table / insert:admonition → app-open-dialog
 *   事件（由挂载对话框的 Toolbar 打开）；insert:hr → editor-insert 分割线文本
 */

/** 菜单 id → store 视图模式 / 主题 */
const VIEW_MODE_IDS = {
  'view-mode-wysiwyg': 'wysiwyg',
  'view-mode-source': 'source',
  'view-mode-split': 'split',
  'view-mode-preview': 'preview',
} as const

const THEME_IDS: Record<string, ThemeMode> = {
  'theme-light': 'light',
  'theme-dark': 'dark',
  'theme-system': 'system',
}

/** 错误日志用的 id 脱敏：open-recent:<path> 不打印完整路径 */
function safeMenuId(id: string): string {
  return id.startsWith('open-recent:') ? 'open-recent:*' : id
}

export async function handleMenuAction(id: string): Promise<void> {
  const store = useEditorStore.getState()

  if (id.startsWith('open-recent:')) {
    await openFileByPath(id.slice('open-recent:'.length))
    return
  }

  // 段落/格式菜单：与右键菜单同一 format:* 约定，转发编辑器事件总线
  if (id.startsWith('format:')) {
    const format = id.slice('format:'.length) as FormatType
    window.dispatchEvent(new CustomEvent('editor-format', { detail: { format } }))
    return
  }

  if (id in VIEW_MODE_IDS) {
    store.setViewMode(VIEW_MODE_IDS[id as keyof typeof VIEW_MODE_IDS])
    return
  }
  if (id in THEME_IDS) {
    store.setThemeMode(THEME_IDS[id])
    return
  }

  switch (id) {
    case 'file-new':
      // 与 useKeyboardShortcuts 一致：脏文档先确认
      if (!store.isDirty || (await confirmDialog(i18n.t('dialog.confirmDiscard') as string))) {
        newFile()
      }
      break
    case 'file-open':
      await openFile()
      break
    case 'file-open-folder':
      await openFolderFromPicker()
      break
    case 'file-reveal':
      if (store.filePath) {
        await revealInFolder(store.filePath).catch(() => {})
      }
      break
    case 'file-save':
      await saveFile()
      break
    case 'file-save-as':
      await saveFileAs()
      break
    case 'clear-recent':
      store.clearRecentFiles()
      break
    case 'export-pdf':
      // 同 MoreMenu：请求 Editor 提供 HTML 后走导出
      window.dispatchEvent(
        new CustomEvent('editor-request-html', { detail: { requestId: Date.now() } })
      )
      break
    case 'edit-undo':
      window.dispatchEvent(new CustomEvent('editor-undo'))
      break
    case 'edit-redo':
      window.dispatchEvent(new CustomEvent('editor-redo'))
      break
    case 'edit-paste-plain': {
      // 粘贴为纯文本：读剪贴板文本，经 editor-insert 替换选区插入
      const text = await readClipboardText().catch(() => '')
      if (text) {
        window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text } }))
      }
      break
    }
    case 'edit-find':
      window.dispatchEvent(new CustomEvent('editor-find'))
      break
    case 'insert:image':
      await insertImageFromPicker()
      break
    case 'insert:table':
    case 'insert:admonition':
      // 对话框仍由 Toolbar 挂载，事件通知打开
      window.dispatchEvent(
        new CustomEvent('app-open-dialog', {
          detail: { dialog: id === 'insert:table' ? 'table' : 'admonition' },
        })
      )
      break
    case 'insert:hr':
      window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: '\n\n---\n\n' } }))
      break
    case 'view-sidebar':
      store.toggleSidebar()
      break
    case 'view-sidebar-files':
    case 'view-sidebar-outline': {
      // 点击 tab 项时若侧栏隐藏则一并展开
      store.setSidebarTab(id === 'view-sidebar-files' ? 'files' : 'outline')
      if (!store.showSidebar) store.toggleSidebar()
      break
    }
    case 'zoom-in':
      store.zoomIn()
      break
    case 'zoom-out':
      store.zoomOut()
      break
    case 'zoom-reset':
      store.zoomReset()
      break
    case 'settings':
      store.setSettingsOpen(true)
      break
    default:
      // predefined 项（cut/copy/paste/about 等）由系统处理，无需前端动作
      break
  }
}

/** 勾选态/可用态同步（菜单重建后初始 check 值是默认值，必须全量同步一次） */
function syncMenuChecks(state: EditorState): void {
  const viewModeChecks: Record<EditorState['viewMode'], string> = {
    wysiwyg: 'view-mode-wysiwyg',
    source: 'view-mode-source',
    split: 'view-mode-split',
    preview: 'view-mode-preview',
  }
  for (const [mode, id] of Object.entries(viewModeChecks)) {
    void invoke('set_menu_item_checked', { id, checked: state.viewMode === mode })
  }
  const themeChecks: Record<ThemeMode, string> = {
    light: 'theme-light',
    dark: 'theme-dark',
    system: 'theme-system',
  }
  for (const [mode, id] of Object.entries(themeChecks)) {
    void invoke('set_menu_item_checked', { id, checked: state.themeMode === mode })
  }
  void invoke('set_menu_item_checked', {
    id: 'view-sidebar-files',
    checked: state.sidebarTab === 'files',
  })
  void invoke('set_menu_item_checked', {
    id: 'view-sidebar-outline',
    checked: state.sidebarTab === 'outline',
  })
}

function syncMenuEnabled(state: EditorState): void {
  void invoke('set_menu_item_enabled', { id: 'edit-undo', enabled: state.canUndo })
  void invoke('set_menu_item_enabled', { id: 'edit-redo', enabled: state.canRedo })
  void invoke('set_menu_item_enabled', { id: 'file-reveal', enabled: state.filePath !== null })
}

function rebuildMenu(state: EditorState): void {
  const payload = {
    lang: state.language,
    recentFiles: state.recentFiles.map(({ name, path }) => ({ name, path })),
  }
  void invoke('rebuild_menu', payload).then(() => {
    // 重建后 check/enabled 回到构建默认值（wysiwyg✓/system✓/undo/redo 可用），
    // 必须按最新状态重新同步一轮
    const latest = useEditorStore.getState()
    syncMenuChecks(latest)
    syncMenuEnabled(latest)
  })
  // macOS Dock 右键菜单同步重建（非 macOS 为 no-op 桩）
  void invoke('update_dock_menu', payload)
}

/**
 * 初始化原生菜单对接（仅 Tauri 桌面端生效）。
 * 返回 cleanup：取消事件监听与 store 订阅。
 */
export async function initNativeMenu(): Promise<() => void> {
  if (!isTauri()) return () => {}

  let unlisten: UnlistenFn | undefined
  try {
    unlisten = await listen<string>('native-menu-event', (event) => {
      handleMenuAction(event.payload).catch((e) =>
        logger.error(`Menu action failed: ${safeMenuId(event.payload)}`, e)
      )
    })
  } catch (e) {
    logger.error('Failed to listen native-menu-event:', e)
    return () => {}
  }

  // 初始全量同步，再订阅增量变化
  const initial = useEditorStore.getState()
  syncMenuChecks(initial)
  syncMenuEnabled(initial)
  rebuildMenu(initial)

  const unsubscribe = useEditorStore.subscribe((state, prev) => {
    if (
      state.canUndo !== prev.canUndo ||
      state.canRedo !== prev.canRedo ||
      state.filePath !== prev.filePath
    ) {
      syncMenuEnabled(state)
    }
    if (
      state.viewMode !== prev.viewMode ||
      state.themeMode !== prev.themeMode ||
      state.sidebarTab !== prev.sidebarTab
    ) {
      syncMenuChecks(state)
    }
    if (state.language !== prev.language || state.recentFiles !== prev.recentFiles) {
      rebuildMenu(state)
    }
  })

  logger.info('Native menu initialized')
  return () => {
    unlisten?.()
    unsubscribe()
  }
}
