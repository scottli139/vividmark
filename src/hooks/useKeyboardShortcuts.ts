import { useEffect, useCallback } from 'react'
import { openFile, saveFile, saveFileAs, newFile } from '../lib/fileOps'
import { useEditorStore } from '../stores/editorStore'

interface ShortcutHandler {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  handler: () => void | Promise<void>
  description: string
}

/**
 * 全局键盘快捷键 Hook
 *
 * 支持的快捷键:
 * - Cmd/Ctrl + O: 打开文件
 * - Cmd/Ctrl + S: 保存文件
 * - Cmd/Ctrl + Shift + S: 另存为
 * - Cmd/Ctrl + N: 新建文件
 */
export function useKeyboardShortcuts() {
  const { isDirty } = useEditorStore()

  const handleNewFile = useCallback(() => {
    if (isDirty) {
      if (confirm('Discard unsaved changes?')) {
        newFile()
      }
    } else {
      newFile()
    }
  }, [isDirty])

  const shortcuts: ShortcutHandler[] = [
    {
      key: 'o',
      metaKey: true,
      handler: openFile,
      description: 'Open file',
    },
    {
      key: 's',
      metaKey: true,
      handler: saveFile,
      description: 'Save file',
    },
    {
      key: 's',
      metaKey: true,
      shiftKey: true,
      handler: saveFileAs,
      description: 'Save file as',
    },
    {
      key: 'n',
      metaKey: true,
      handler: handleNewFile,
      description: 'New file',
    },
  ]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在输入框中，如果是则不触发快捷键
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // 允许在 textarea 中使用 Cmd+S 保存
        if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's')) {
          return
        }
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdKey = isMac ? e.metaKey : e.ctrlKey

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const cmdMatch = shortcut.metaKey ? cmdKey : true
        const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey

        if (keyMatch && cmdMatch && shiftMatch) {
          e.preventDefault()
          shortcut.handler()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
