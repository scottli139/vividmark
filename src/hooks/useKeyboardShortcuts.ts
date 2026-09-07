import { useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { openFile, openFileSmart, saveFile, saveFileAs, newFile } from '../lib/fileOps'
import { confirmDialog } from '../lib/dialog'
import { readClipboardText } from '../lib/clipboard'
import { openFolderFromPicker } from '../lib/editorActions'
import { isTauri } from '../lib/imageSrc'
import { createLogger } from '../lib/logger'
import { useEditorStore } from '../stores/editorStore'
import type { FormatType } from '../lib/markdownEditing'

const logger = createLogger('KeyboardShortcuts')

interface ShortcutHandler {
  key: string
  altKey?: boolean
  shiftKey?: boolean
  /** false 表示不要求 Cmd/Ctrl（如 F11）；缺省要求 */
  mod?: boolean
  /** 焦点在 INPUT/TEXTAREA 时是否放行（文本编辑类快捷键不放行） */
  allowInInput?: boolean
  handler: () => void | Promise<void | boolean>
  description?: string
}

const emit = (name: string, detail?: unknown): void => {
  window.dispatchEvent(new CustomEvent(name, detail !== undefined ? { detail } : undefined))
}

const emitFormat = (format: FormatType) => emit('editor-format', { format })

/**
 * 全局键盘快捷键 Hook
 *
 * 平台分工：macOS/Linux 桌面端带 accelerator 的键被原生菜单 OS 级拦截（webview
 * 收不到 keydown，此 hook 对那些键是死代码）；Windows 桌面端（无原生菜单）与
 * 浏览器 dev/E2E 由此 hook 全量接管，键位表与 src-tauri/src/menu.rs 对齐。
 *
 * 防重入：编辑器（CM/PM）自家 keymap 先处理 keydown 并 preventDefault
 * （如 Milkdown Mod-B/I、CM Mod-F/Z），本 hook 对 defaultPrevented 事件直接放行。
 *
 * 核心快捷键:
 * - Cmd/Ctrl + O: 打开文件  / + Shift: 打开文件夹
 * - Cmd/Ctrl + S: 保存文件  / + Shift: 另存为
 * - Cmd/Ctrl + N: 新建窗口（浏览器：新建文件，脏确认）
 * - Cmd/Ctrl + /: 切换 Source ↔ WYSIWYG 模式（Typora 同款）
 */
export function useKeyboardShortcuts() {
  const { t } = useTranslation()
  const { isDirty } = useEditorStore()

  const handleNewFile = useCallback(async () => {
    if (isDirty) {
      if (await confirmDialog(t('dialog.confirmDiscard'))) {
        newFile()
      }
    } else {
      newFile()
    }
  }, [isDirty, t])

  // WYSIWYG ⇄ Source 互切；preview/split 模式下切到 wysiwyg
  const handleToggleWysiwyg = useCallback(() => {
    const store = useEditorStore.getState()
    store.setViewMode(store.viewMode === 'wysiwyg' ? 'source' : 'wysiwyg')
  }, [])

  // 新建/打开：桌面端走多窗口路由（Typora 式 SDI），浏览器只能本窗口
  const handleNew = useCallback(() => {
    if (isTauri()) {
      void invoke('open_in_new_window', { path: null }).catch((e) =>
        logger.error('Failed to create window:', e)
      )
    } else {
      void handleNewFile()
    }
  }, [handleNewFile])

  const handleOpen = useCallback(() => {
    return isTauri() ? openFileSmart() : openFile()
  }, [])

  // 使用 useMemo 避免每次渲染重新创建数组
  const shortcuts: ShortcutHandler[] = useMemo(() => {
    const store = () => useEditorStore.getState()
    const list: ShortcutHandler[] = [
      // ---- 文件 ----
      { key: 'n', allowInInput: true, handler: handleNew, description: t('shortcuts.newFile') },
      { key: 'o', allowInInput: true, handler: handleOpen, description: t('shortcuts.openFile') },
      {
        key: 'o',
        shiftKey: true,
        allowInInput: true,
        handler: () => openFolderFromPicker(),
      },
      { key: 's', allowInInput: true, handler: saveFile, description: t('shortcuts.saveFile') },
      {
        key: 's',
        shiftKey: true,
        allowInInput: true,
        handler: saveFileAs,
        description: t('shortcuts.saveAs'),
      },
      { key: 'p', allowInInput: true, handler: () => emit('editor-export-pdf') },
      { key: ',', allowInInput: true, handler: () => store().setSettingsOpen(true) },
      // ---- 编辑 ----
      { key: 'z', handler: () => emit('editor-undo') },
      { key: 'z', shiftKey: true, handler: () => emit('editor-redo') },
      {
        key: 'v',
        shiftKey: true,
        handler: async () => {
          // 粘贴为纯文本：读剪贴板文本，经 editor-insert 替换选区插入
          const text = await readClipboardText().catch(() => '')
          if (text) emit('editor-insert', { text })
        },
      },
      { key: 'f', handler: () => emit('editor-find') },
      // ---- 格式 ----
      { key: 'b', handler: () => emitFormat('bold') },
      { key: 'i', handler: () => emitFormat('italic') },
      { key: 'k', handler: () => emitFormat('link') },
      { key: '0', handler: () => emitFormat('paragraph') },
      { key: '1', handler: () => emitFormat('h1') },
      { key: '2', handler: () => emitFormat('h2') },
      { key: '3', handler: () => emitFormat('h3') },
      { key: '4', handler: () => emitFormat('h4') },
      { key: '5', handler: () => emitFormat('h5') },
      { key: '6', handler: () => emitFormat('h6') },
      // ---- 段落 ----
      { key: 'q', altKey: true, handler: () => emitFormat('quote') },
      { key: 'u', altKey: true, handler: () => emitFormat('list') },
      { key: 'o', altKey: true, handler: () => emitFormat('ol') },
      { key: 'x', altKey: true, handler: () => emitFormat('tasklist') },
      { key: 'c', altKey: true, handler: () => emitFormat('codeblock') },
      // ---- 视图 ----
      { key: 'b', shiftKey: true, allowInInput: true, handler: () => store().toggleSidebar() },
      { key: '1', altKey: true, allowInInput: true, handler: () => store().setViewMode('wysiwyg') },
      { key: '2', altKey: true, allowInInput: true, handler: () => store().setViewMode('source') },
      { key: '3', altKey: true, allowInInput: true, handler: () => store().setViewMode('split') },
      { key: '4', altKey: true, allowInInput: true, handler: () => store().setViewMode('preview') },
      { key: '=', allowInInput: true, handler: () => store().zoomIn() },
      { key: '-', allowInInput: true, handler: () => store().zoomOut() },
      { key: '0', shiftKey: true, allowInInput: true, handler: () => store().zoomReset() },
      {
        key: '/',
        allowInInput: true,
        handler: handleToggleWysiwyg,
        description: t('shortcuts.toggleWysiwyg'),
      },
    ]
    if (isTauri()) {
      list.push({
        key: 'F11',
        mod: false,
        allowInInput: true,
        handler: async () => {
          const win = getCurrentWindow()
          await win.setFullscreen(!(await win.isFullscreen()))
        },
      })
    }
    return list
  }, [handleNew, handleOpen, handleToggleWysiwyg, t])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 编辑器自家 keymap（CM Mod-F/Z、Milkdown Mod-B/I 等）已处理过的不重复触发
      if (e.defaultPrevented) return

      // 输入框内只放行非文本编辑类快捷键（Ctrl+S/O/N 等）
      const target = e.target as HTMLElement
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdKey = isMac ? e.metaKey : e.ctrlKey

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const cmdMatch = shortcut.mod === false ? true : cmdKey
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.altKey ? e.altKey : !e.altKey

        if (keyMatch && cmdMatch && shiftMatch && altMatch) {
          if (inInput && !shortcut.allowInInput) continue
          e.preventDefault()
          Promise.resolve(shortcut.handler()).catch((err) =>
            logger.error(`Shortcut ${shortcut.key} failed:`, err)
          )
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
