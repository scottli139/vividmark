import { useCallback, useState, useEffect } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { dragDropLogger } from '../lib/logger'

interface DragState {
  isDragging: boolean
  fileName: string | null
}

/**
 * 文件拖放 Hook
 *
 * 处理将文件拖放到编辑器窗口打开的功能
 */
export function useFileDragDrop() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    fileName: null,
  })
  const { isDirty } = useEditorStore()

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer?.types.includes('Files')) {
      const files = e.dataTransfer.items
      if (files.length > 0) {
        const file = files[0]
        // 检查是否是支持的文件类型
        if (file.kind === 'file') {
          setDragState({
            isDragging: true,
            fileName: null, // 在 Tauri 中无法获取文件名，需要用其他方式
          })
        }
      }
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 只有当离开整个窗口时才重置状态
    if (e.relatedTarget === null) {
      setDragState({ isDragging: false, fileName: null })
    }
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setDragState({ isDragging: false, fileName: null })

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      // 在 Tauri 中，我们需要使用 Tauri 的 API 来获取文件路径
      // 但在 web 环境中，File 对象没有路径信息
      // 这里我们使用 Tauri 的文件系统插件来处理
      const file = files[0]

      // 检查文件扩展名
      const validExtensions = ['.md', '.markdown', '.txt']
      const fileName = file.name.toLowerCase()
      const isValidFile = validExtensions.some((ext) => fileName.endsWith(ext))

      if (!isValidFile) {
        alert('Please drop a Markdown file (.md, .markdown, .txt)')
        return
      }

      // 如果有未保存的更改，询问用户
      if (isDirty) {
        if (!confirm('Discard unsaved changes?')) {
          return
        }
      }

      // 读取文件内容
      try {
        const content = await file.text()

        dragDropLogger.info('File dropped:', { name: file.name, size: content.length })

        // 使用 Tauri 的 API 获取文件路径
        // 在 Tauri 2.0 中，我们需要使用 @tauri-apps/plugin-fs
        // 但对于拖放，我们需要直接使用文件路径
        // 这里我们暂时使用文件名作为路径
        const store = useEditorStore.getState()
        store.setContent(content)
        store.setFileName(file.name)
        store.setFilePath('') // 拖放的文件没有完整路径
        store.setDirty(true) // 标记为已修改，因为没有完整路径无法保存
      } catch (error) {
        dragDropLogger.error('Failed to read dropped file:', error)
        alert('Failed to read file')
      }
    },
    [isDirty]
  )

  useEffect(() => {
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDragOver, handleDragLeave, handleDrop])

  return dragState
}
