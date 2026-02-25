import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { saveFile } from '../lib/fileOps'

const AUTO_SAVE_DELAY = 2000 // 2 秒后自动保存

/**
 * 自动保存 Hook
 *
 * 当内容变化后，延迟一段时间自动保存到文件
 * 只有在有文件路径时才会触发自动保存
 */
export function useAutoSave() {
  const { content, filePath, isDirty } = useEditorStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)

  const performAutoSave = useCallback(async () => {
    if (!filePath || !isDirty || isSavingRef.current) {
      return
    }

    isSavingRef.current = true
    try {
      await saveFile()
      console.log('Auto-saved:', new Date().toLocaleTimeString())
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      isSavingRef.current = false
    }
  }, [filePath, isDirty])

  useEffect(() => {
    // 清除之前的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // 如果有文件路径且有未保存的更改，设置自动保存
    if (filePath && isDirty) {
      timerRef.current = setTimeout(performAutoSave, AUTO_SAVE_DELAY)
    }

    // 清理函数
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [content, filePath, isDirty, performAutoSave])
}
