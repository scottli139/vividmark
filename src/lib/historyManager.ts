/**
 * 历史记录管理器
 *
 * 用于实现编辑器的撤销/重做功能
 *
 * 设计说明：
 * - undoStack: 存储可以"撤销回去的"历史状态（旧的在底部，新的在顶部）
 * - redoStack: 存储被撤销的状态，用于重做
 *
 * 工作流程：
 * 1. push(state): 将当前状态添加到 undoStack
 * 2. undo(current): 返回 undoStack 中"上一个"状态，将 current 放入 redoStack
 * 3. redo(current): 返回 redoStack 顶部状态，将 current 放入 undoStack
 *
 * 例如：
 * - 初始: undoStack = []
 * - push('first'): undoStack = ['first']
 * - push('second'): undoStack = ['first', 'second']
 * - push('third'): undoStack = ['first', 'second', 'third']
 * - undo('third-current'): 返回 'second', undoStack = ['first'], redoStack = ['third', 'third-current']
 * - undo('second'): 返回 'first', undoStack = [], redoStack = ['third', 'third-current', 'second']
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
   * @param currentState 当前状态（会被保存到 redo 栈）
   * @returns 撤销后的状态（undo 栈顶的"上一个"状态），如果无法撤销则返回 null
   *
   * 关键逻辑：
   * - undoStack 存储的是可以回到的历史状态
   * - 最后一个 push 的状态是"当前"在历史栈中的状态
   * - undo 需要返回"上一个"状态（即倒数第二个）
   * - 同时将当前正在编辑的状态保存到 redoStack
   */
  undo(currentState: HistoryState): HistoryState | null {
    // 需要至少两个状态才能撤销到上一个：
    // - 栈顶是"当前历史状态"
    // - 需要回到"上一个历史状态"（栈中倒数第二个）
    if (this.undoStack.length < 1) {
      return null
    }

    // 如果只有一个状态，撤销后就没有历史了，返回那个状态
    if (this.undoStack.length === 1) {
      const onlyState = this.undoStack[0]
      // 将当前编辑状态保存到 redo 栈
      this.redoStack.push(currentState)
      // 清空 undo 栈，因为我们回到了唯一的历史状态
      this.undoStack = []
      return onlyState
    }

    // 弹出栈顶的"当前历史状态"
    this.undoStack.pop()

    // 将当前正在编辑的状态保存到 redo 栈
    this.redoStack.push(currentState)

    // 返回现在的栈顶（上一个历史状态）
    const previousState = this.undoStack[this.undoStack.length - 1]
    return previousState ?? null
  }

  /**
   * 重做操作
   * @param currentState 当前状态（会被保存到 undo 栈）
   * @returns 重做后的状态（redo 栈顶的状态），如果无法重做则返回 null
   */
  redo(currentState: HistoryState): HistoryState | null {
    if (this.redoStack.length === 0) {
      return null
    }

    // 从 redoStack 取出下一个状态
    const nextState = this.redoStack.pop()
    if (!nextState) {
      return null
    }

    // 将当前状态保存到 undo 栈
    this.undoStack.push(currentState)

    return nextState
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
