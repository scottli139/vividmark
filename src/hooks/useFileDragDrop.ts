import { useCallback, useState, useEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useTranslation } from 'react-i18next'
import { openFileByPath } from '../lib/fileOps'
import { useEditorStore } from '../stores/editorStore'
import { dragDropLogger } from '../lib/logger'

interface DragState {
  isDragging: boolean
  fileName: string | null
}

interface DragDropPayload {
  type: 'enter' | 'over' | 'drop' | 'leave'
  paths?: string[]
  position?: { x: number; y: number }
}

interface DragDropMetrics {
  dragEnterCount: number
  dropCount: number
  successCount: number
  errorCount: number
  lastError?: string
}

// 全局监控指标（用于调试和诊断）
const metrics: DragDropMetrics = {
  dragEnterCount: 0,
  dropCount: 0,
  successCount: 0,
  errorCount: 0,
}

/**
 * 获取拖放监控指标（用于诊断）
 */
export function getDragDropMetrics(): DragDropMetrics {
  return { ...metrics }
}

/**
 * 文件拖放 Hook
 *
 * 处理将文件拖放到编辑器窗口打开的功能
 */
export function useFileDragDrop() {
  const { t } = useTranslation()
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    fileName: null,
  })
  const { isDirty } = useEditorStore()
  const unlistenRef = useRef<(() => void) | null>(null)

  const handleDrop = useCallback(
    async (paths: string[]) => {
      metrics.dropCount++
      dragDropLogger.time('drop-processing')

      if (!paths || paths.length === 0) {
        dragDropLogger.warn('Drop event received but no paths provided')
        return
      }

      const filePath = paths[0]
      const fileName = filePath.split(/[/\\]/).pop() || ''

      dragDropLogger.info('Processing dropped file:', {
        path: filePath,
        name: fileName,
        totalDrops: metrics.dropCount,
      })

      // 检查文件扩展名
      const validExtensions = ['.md', '.markdown', '.txt']
      const lowerFileName = fileName.toLowerCase()
      const isValidFile = validExtensions.some((ext) => lowerFileName.endsWith(ext))

      if (!isValidFile) {
        dragDropLogger.warn('Invalid file type:', { fileName, validExtensions })
        alert(t('messages.invalidFileType'))
        return
      }

      // 如果有未保存的更改，询问用户
      if (isDirty) {
        dragDropLogger.debug('Unsaved changes detected, showing confirm dialog')
        if (!confirm(t('dialog.confirmDiscard'))) {
          dragDropLogger.info('User cancelled drop due to unsaved changes')
          return
        }
      }

      // 使用 Tauri 的 openFileByPath 读取文件
      try {
        dragDropLogger.time('open-file')
        const success = await openFileByPath(filePath)
        dragDropLogger.timeEnd('open-file')

        if (success) {
          metrics.successCount++
          dragDropLogger.info('File opened successfully:', {
            fileName,
            successCount: metrics.successCount,
          })
        } else {
          metrics.errorCount++
          metrics.lastError = 'openFileByPath returned false'
          dragDropLogger.error('Failed to open file:', { fileName, error: metrics.lastError })
        }
      } catch (error) {
        metrics.errorCount++
        metrics.lastError = error instanceof Error ? error.message : String(error)
        dragDropLogger.error('Exception while opening dropped file:', {
          fileName,
          error: metrics.lastError,
        })
        alert(t('messages.openFileFailed'))
      }

      dragDropLogger.timeEnd('drop-processing')
    },
    [isDirty, t]
  )

  useEffect(() => {
    let isMounted = true

    const setupDragDrop = async () => {
      try {
        // 等待 Tauri 初始化
        await new Promise((resolve) => setTimeout(resolve, 1000))

        if (!isMounted) {
          dragDropLogger.debug('Component unmounted before setup')
          return
        }

        dragDropLogger.info('Setting up window drag drop listener...', {
          currentMetrics: { ...metrics },
        })

        const currentWindow = getCurrentWindow()
        dragDropLogger.debug('Got current window:', currentWindow.label)

        // 使用 Tauri 2.0 的 onDragDropEvent
        const unlisten = await currentWindow.onDragDropEvent((event) => {
          if (!isMounted) {
            dragDropLogger.debug('Event received but component unmounted')
            return
          }

          // 详细的原始事件日志（用于调试）
          dragDropLogger.debug('Raw drag drop event:', {
            eventType: typeof event,
            hasPayload: !!event.payload,
            payloadType: typeof event.payload,
          })

          let payload: DragDropPayload

          try {
            payload = event.payload as DragDropPayload
          } catch (e) {
            dragDropLogger.error('Failed to parse event payload:', e)
            return
          }

          if (!payload) {
            dragDropLogger.warn('No payload in event')
            return
          }

          dragDropLogger.debug('Processing event:', {
            type: payload.type,
            hasPaths: !!payload.paths,
          })

          switch (payload.type) {
            case 'enter':
              metrics.dragEnterCount++
              dragDropLogger.info('Drag enter:', {
                paths: payload.paths,
                position: payload.position,
                enterCount: metrics.dragEnterCount,
              })
              if (payload.paths && payload.paths.length > 0) {
                const fileName = payload.paths[0].split(/[/\\]/).pop() || t('messages.unknownFile')
                setDragState({
                  isDragging: true,
                  fileName,
                })
              }
              break

            case 'over':
              // 拖拽在窗口上方移动 - 不需要频繁日志
              break

            case 'drop':
              dragDropLogger.info('Drop event:', {
                paths: payload.paths,
                position: payload.position,
              })
              setDragState({ isDragging: false, fileName: null })
              if (payload.paths && payload.paths.length > 0) {
                handleDrop(payload.paths)
              } else {
                dragDropLogger.warn('Drop event with no paths')
              }
              break

            case 'leave':
              dragDropLogger.debug('Drag leave')
              setDragState({ isDragging: false, fileName: null })
              break

            default:
              dragDropLogger.warn('Unknown drag drop event type:', payload.type)
          }
        })

        if (isMounted) {
          unlistenRef.current = unlisten
          dragDropLogger.info('Drag drop listener setup complete')
        } else {
          unlisten()
          dragDropLogger.debug('Unlisten called due to unmount')
        }
      } catch (error) {
        metrics.errorCount++
        metrics.lastError = error instanceof Error ? error.message : String(error)
        dragDropLogger.error('Failed to setup drag drop:', {
          error: metrics.lastError,
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }

    setupDragDrop()

    return () => {
      dragDropLogger.debug('useFileDragDrop cleanup')
      isMounted = false
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = null
        dragDropLogger.debug('Drag drop listener removed')
      }
    }
  }, [handleDrop, t])

  return dragState
}
