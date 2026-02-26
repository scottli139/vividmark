import { describe, it, expect, beforeEach } from 'vitest'
import { HistoryManager } from '../historyManager'

describe('HistoryManager', () => {
  let historyManager: HistoryManager

  beforeEach(() => {
    historyManager = new HistoryManager(100)
  })

  describe('push', () => {
    it('should push state to undo stack', () => {
      historyManager.push({ content: 'first', timestamp: 1 })
      expect(historyManager.canUndo()).toBe(true)
      expect(historyManager.getStats().undoCount).toBe(1)
    })

    it('should not push duplicate content', () => {
      historyManager.push({ content: 'same', timestamp: 1 })
      historyManager.push({ content: 'same', timestamp: 2 })
      expect(historyManager.getStats().undoCount).toBe(1)
    })

    it('should clear redo stack when pushing new state', () => {
      // Setup: push two states, undo to create redo history
      historyManager.push({ content: 'first', timestamp: 1 })
      historyManager.push({ content: 'second', timestamp: 2 })
      historyManager.undo({ content: 'second-current', timestamp: 3 })
      expect(historyManager.canRedo()).toBe(true)

      // Push new state should clear redo stack
      historyManager.push({ content: 'third', timestamp: 4 })
      expect(historyManager.canRedo()).toBe(false)
      // After undo and push: undoStack had ['first'], undo popped 'second', 
      // so we have ['first'] then push 'third' → ['first', 'third']
      expect(historyManager.getStats().undoCount).toBe(2)
    })

    it('should respect max size limit', () => {
      const smallManager = new HistoryManager(3)
      smallManager.push({ content: '1', timestamp: 1 })
      smallManager.push({ content: '2', timestamp: 2 })
      smallManager.push({ content: '3', timestamp: 3 })
      smallManager.push({ content: '4', timestamp: 4 })

      expect(smallManager.getStats().undoCount).toBe(3)
    })
  })

  describe('undo', () => {
    it('should return null when undo stack is empty', () => {
      const result = historyManager.undo({ content: 'current', timestamp: 1 })
      expect(result).toBeNull()
    })

    it('should return previous state when undoing', () => {
      // Setup: push two states
      historyManager.push({ content: 'first', timestamp: 1 })
      historyManager.push({ content: 'second', timestamp: 2 })

      // Undo - should return 'first' (the previous state)
      const result = historyManager.undo({ content: 'second-edited', timestamp: 3 })

      expect(result?.content).toBe('first')
      expect(historyManager.canUndo()).toBe(true) // still has 'first'
      expect(historyManager.canRedo()).toBe(true)
      expect(historyManager.getStats()).toEqual({ undoCount: 1, redoCount: 1 })
    })

    it('should handle undo with single state', () => {
      historyManager.push({ content: 'only', timestamp: 1 })

      const result = historyManager.undo({ content: 'current', timestamp: 2 })

      expect(result?.content).toBe('only')
      expect(historyManager.canUndo()).toBe(false) // no more history
      expect(historyManager.canRedo()).toBe(true)
    })

    it('should handle multiple undos correctly', () => {
      // Setup: push three states
      historyManager.push({ content: 'first', timestamp: 1 })
      historyManager.push({ content: 'second', timestamp: 2 })
      historyManager.push({ content: 'third', timestamp: 3 })

      // Undo once: should return 'second'
      let result = historyManager.undo({ content: 'third-current', timestamp: 4 })
      expect(result?.content).toBe('second')
      expect(historyManager.getStats()).toEqual({ undoCount: 2, redoCount: 1 })

      // Undo again: should return 'first'
      result = historyManager.undo({ content: 'second', timestamp: 5 })
      expect(result?.content).toBe('first')
      expect(historyManager.getStats()).toEqual({ undoCount: 1, redoCount: 2 })

      // One more undo: should return 'first' (only state) and clear undo stack
      result = historyManager.undo({ content: 'first', timestamp: 6 })
      expect(result?.content).toBe('first')
      expect(historyManager.canUndo()).toBe(false)
      expect(historyManager.getStats()).toEqual({ undoCount: 0, redoCount: 3 })
    })
  })

  describe('redo', () => {
    it('should return null when redo stack is empty', () => {
      const result = historyManager.redo({ content: 'current', timestamp: 1 })
      expect(result).toBeNull()
    })

    it('should return next state after undo', () => {
      // Setup: push, then undo to create redo history
      historyManager.push({ content: 'first', timestamp: 1 })
      historyManager.push({ content: 'second', timestamp: 2 })
      historyManager.undo({ content: 'second-modified', timestamp: 3 })

      // Redo: should return 'second-modified'
      const result = historyManager.redo({ content: 'first', timestamp: 4 })

      expect(result?.content).toBe('second-modified')
      expect(historyManager.canUndo()).toBe(true)
      expect(historyManager.canRedo()).toBe(false)
    })

    it('should handle undo then redo sequence correctly', () => {
      historyManager.push({ content: 'first', timestamp: 1 })
      historyManager.push({ content: 'second', timestamp: 2 })

      // Undo
      let result = historyManager.undo({ content: 'second-current', timestamp: 3 })
      expect(result?.content).toBe('first')
      expect(historyManager.getStats()).toEqual({ undoCount: 1, redoCount: 1 })

      // Redo
      result = historyManager.redo({ content: 'first', timestamp: 4 })
      expect(result?.content).toBe('second-current')
      expect(historyManager.getStats()).toEqual({ undoCount: 2, redoCount: 0 })
    })
  })

  describe('clear', () => {
    it('should clear both stacks', () => {
      historyManager.push({ content: 'first', timestamp: 1 })
      historyManager.push({ content: 'second', timestamp: 2 })
      historyManager.undo({ content: 'second', timestamp: 3 })

      historyManager.clear()

      expect(historyManager.canUndo()).toBe(false)
      expect(historyManager.canRedo()).toBe(false)
      expect(historyManager.getStats()).toEqual({ undoCount: 0, redoCount: 0 })
    })
  })

  describe('getStats', () => {
    it('should return correct counts', () => {
      expect(historyManager.getStats()).toEqual({ undoCount: 0, redoCount: 0 })

      historyManager.push({ content: 'first', timestamp: 1 })
      expect(historyManager.getStats()).toEqual({ undoCount: 1, redoCount: 0 })

      historyManager.push({ content: 'second', timestamp: 2 })
      expect(historyManager.getStats()).toEqual({ undoCount: 2, redoCount: 0 })

      historyManager.undo({ content: 'second', timestamp: 3 })
      expect(historyManager.getStats()).toEqual({ undoCount: 1, redoCount: 1 })
    })
  })

  describe('complex scenarios', () => {
    it('should handle edit after undo correctly', () => {
      // Setup
      historyManager.push({ content: 'first', timestamp: 1 })
      historyManager.push({ content: 'second', timestamp: 2 })

      // Undo to 'first'
      const undoResult = historyManager.undo({ content: 'second', timestamp: 3 })
      expect(undoResult?.content).toBe('first')

      // New edit should clear redo stack
      historyManager.push({ content: 'third', timestamp: 4 })

      expect(historyManager.canRedo()).toBe(false)
      // undoStack: ['first', 'third']
      expect(historyManager.getStats().undoCount).toBe(2)

      // Undo should go back to 'first'
      const result = historyManager.undo({ content: 'third', timestamp: 5 })
      expect(result?.content).toBe('first')
    })

    it('should maintain correct order through multiple operations', () => {
      const contents = ['a', 'b', 'c', 'd', 'e']

      // Push all states: undoStack = [a, b, c, d, e]
      contents.forEach((content, i) => {
        historyManager.push({ content, timestamp: i })
      })

      // Undo twice
      historyManager.undo({ content: 'e-current', timestamp: 10 })
      historyManager.undo({ content: 'd-current', timestamp: 11 })

      // After two undos: undoStack = [a, b, c], redoStack = [e-current, d-current]
      expect(historyManager.getStats()).toEqual({ undoCount: 3, redoCount: 2 })

      // Redo once: should return 'd-current'
      const redoResult = historyManager.redo({ content: 'c', timestamp: 12 })
      expect(redoResult?.content).toBe('d-current')
    })

    it('should handle real-world editing workflow', () => {
      // Simulate: User types "Hello", then " World", then "!"
      historyManager.push({ content: 'Hello', timestamp: 1 })
      historyManager.push({ content: 'Hello World', timestamp: 2 })
      historyManager.push({ content: 'Hello World!', timestamp: 3 })

      // User presses Ctrl+Z: should go back to "Hello World"
      let result = historyManager.undo({ content: 'Hello World!!', timestamp: 4 })
      expect(result?.content).toBe('Hello World')

      // User presses Ctrl+Z again: should go back to "Hello"
      result = historyManager.undo({ content: 'Hello World', timestamp: 5 })
      expect(result?.content).toBe('Hello')

      // User presses Ctrl+Shift+Z (redo): should return to "Hello World"
      result = historyManager.redo({ content: 'Hello', timestamp: 6 })
      expect(result?.content).toBe('Hello World')
    })
  })
})
