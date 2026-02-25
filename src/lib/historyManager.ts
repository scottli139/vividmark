/**
 * 历史记录管理器
 *
 * 用于实现编辑器的撤销/重做功能
 * 维护两个栈：undo 栈和 redo 栈
 */

export interface HistoryState {
  content: string
  timestamp: number
}

export class HistoryManager {
  private undoStack: HistoryState[] = []
  private redoStack: HistoryState[] = []
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  /**
   * 推送新状态到历史记录
   * 会清空 redo 栈（因为新操作使重做历史失效）
   */
  push(state: HistoryState): void {
    // 避免重复推送相同内容
    const lastState = this.undoStack[this.undoStack.length - 1]
    if (lastState && lastState.content === state.content) {
      return
    }

    this.undoStack.push(state)

    // 超过最大容量时移除最旧的记录
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift()
    }

    // 新操作使 redo 栈失效
    this.redoStack = []
  }

  /**
   * 撤销操作
   * 将当前状态推入 redo 栈，返回 undo 栈顶状态
   */
  undo(currentState: HistoryState): HistoryState | null {
    if (this.undoStack.length === 0) {
      return null
    }

    // 将当前状态保存到 redo 栈
    this.redoStack.push(currentState)

    // 返回上一个状态
    return this.undoStack.pop() ?? null
  }

  /**
   * 重做操作
   * 将当前状态推入 undo 栈，返回 redo 栈顶状态
   */
  redo(currentState: HistoryState): HistoryState | null {
    if (this.redoStack.length === 0) {
      return null
    }

    // 将当前状态保存到 undo 栈
    this.undoStack.push(currentState)

    // 返回重做状态
    return this.redoStack.pop() ?? null
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  /**
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /**
   * 清空所有历史记录
   */
  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }

  /**
   * 获取历史记录统计信息
   */
  getStats(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    }
  }
}
