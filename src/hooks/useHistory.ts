import { useCallback, useRef } from 'react'
import { HistoryManager, type HistoryState } from '../lib/historyManager'

/**
 * 历史记录管理 Hook
 *
 * 提供撤销/重做功能，与编辑器内容状态配合使用
 */
export function useHistory(
  getContent: () => string,
  setContent: (content: string) => void,
  setDirty?: (dirty: boolean) => void
) {
  const historyManagerRef = useRef(new HistoryManager(100))

  /**
   * 推送当前状态到历史记录
   * 应在用户进行编辑操作后调用
   */
  const pushHistory = useCallback((state: string) => {
    historyManagerRef.current.push({
      content: state,
      timestamp: Date.now(),
    })
  }, [])

  /**
   * 撤销操作
   * 返回撤销后的内容，或 null 表示无法撤销
   */
  const undo = useCallback((): string | null => {
    const currentState: HistoryState = {
      content: getContent(),
      timestamp: Date.now(),
    }

    const previousState = historyManagerRef.current.undo(currentState)
    if (previousState) {
      setContent(previousState.content)
      setDirty?.(true)
      return previousState.content
    }
    return null
  }, [getContent, setContent, setDirty])

  /**
   * 重做操作
   * 返回重做后的内容，或 null 表示无法重做
   */
  const redo = useCallback((): string | null => {
    const currentState: HistoryState = {
      content: getContent(),
      timestamp: Date.now(),
    }

    const nextState = historyManagerRef.current.redo(currentState)
    if (nextState) {
      setContent(nextState.content)
      setDirty?.(true)
      return nextState.content
    }
    return null
  }, [getContent, setContent, setDirty])

  /**
   * 检查是否可以撤销
   */
  const canUndo = useCallback((): boolean => {
    return historyManagerRef.current.canUndo()
  }, [])

  /**
   * 检查是否可以重做
   */
  const canRedo = useCallback((): boolean => {
    return historyManagerRef.current.canRedo()
  }, [])

  /**
   * 清空历史记录
   * 用于新文件打开时重置历史
   */
  const clearHistory = useCallback(() => {
    historyManagerRef.current.clear()
  }, [])

  /**
   * 获取历史记录统计
   */
  const getHistoryStats = useCallback(() => {
    return historyManagerRef.current.getStats()
  }, [])

  return {
    pushHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    getHistoryStats,
  }
}
