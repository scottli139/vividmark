import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistory } from '../useHistory'

describe('useHistory', () => {
  const mockSetContent = vi.fn()
  const mockSetDirty = vi.fn()
  let mockGetContent: () => string

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetContent = vi.fn(() => 'current content')
  })

  describe('pushHistory', () => {
    it('should push content to history', () => {
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      act(() => {
        result.current.pushHistory('new content')
      })

      expect(result.current.canUndo()).toBe(true)
    })

    it('should not create duplicate entries for same content', () => {
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      act(() => {
        result.current.pushHistory('same content')
        result.current.pushHistory('same content')
        result.current.pushHistory('same content')
      })

      const stats = result.current.getHistoryStats()
      expect(stats.undoCount).toBe(1)
    })
  })

  describe('undo', () => {
    it('should return null when nothing to undo', () => {
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      let undoResult: string | null = 'not null'
      act(() => {
        undoResult = result.current.undo()
      })

      expect(undoResult).toBeNull()
      expect(mockSetContent).not.toHaveBeenCalled()
    })

    it('should undo to previous state', () => {
      mockGetContent = vi.fn(() => 'second content')
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      // Push initial states
      act(() => {
        result.current.pushHistory('first content')
        result.current.pushHistory('second content')
      })

      // Undo
      let undoResult: string | null = null
      act(() => {
        undoResult = result.current.undo()
      })

      expect(undoResult).toBe('first content')
      expect(mockSetContent).toHaveBeenCalledWith('first content')
      expect(mockSetDirty).toHaveBeenCalledWith(true)
    })

    it('should allow redo after undo', () => {
      mockGetContent = vi.fn(() => 'second content')
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      act(() => {
        result.current.pushHistory('first content')
        result.current.pushHistory('second content')
      })

      act(() => {
        result.current.undo()
      })

      expect(result.current.canRedo()).toBe(true)
    })

    it('should get current content from getter function', () => {
      let currentContent = 'current'
      mockGetContent = vi.fn(() => currentContent)

      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      // Push a state
      act(() => {
        result.current.pushHistory('pushed content')
      })

      // Change the "current" content that the getter returns
      currentContent = 'modified content'

      // Undo - should use the getter to get the current state
      act(() => {
        result.current.undo()
      })

      // Verify the getter was called
      expect(mockGetContent).toHaveBeenCalled()
    })
  })

  describe('redo', () => {
    it('should return null when nothing to redo', () => {
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      let redoResult: string | null = 'not null'
      act(() => {
        redoResult = result.current.redo()
      })

      expect(redoResult).toBeNull()
    })

    it('should redo to next state after undo', () => {
      let currentContent = 'third content'
      mockGetContent = vi.fn(() => currentContent)

      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      // Setup history
      act(() => {
        result.current.pushHistory('first content')
        result.current.pushHistory('second content')
        result.current.pushHistory('third content')
      })

      // Undo twice
      act(() => {
        currentContent = 'third content'
        result.current.undo()
      })
      act(() => {
        currentContent = 'second content'
        result.current.undo()
      })

      expect(result.current.getHistoryStats()).toEqual({
        undoCount: 1,
        redoCount: 2,
      })

      // Redo
      mockSetContent.mockClear()
      let redoResult: string | null = null
      act(() => {
        currentContent = 'first content'
        redoResult = result.current.redo()
      })

      // Redo returns the state that was stored in redoStack
      expect(redoResult).toBe('second content')
      expect(mockSetContent).toHaveBeenCalledWith('second content')
    })
  })

  describe('clearHistory', () => {
    it('should clear all history', () => {
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      act(() => {
        result.current.pushHistory('content 1')
        result.current.pushHistory('content 2')
      })

      expect(result.current.canUndo()).toBe(true)

      act(() => {
        result.current.clearHistory()
      })

      expect(result.current.canUndo()).toBe(false)
      expect(result.current.canRedo()).toBe(false)
      expect(result.current.getHistoryStats()).toEqual({
        undoCount: 0,
        redoCount: 0,
      })
    })
  })

  describe('getHistoryStats', () => {
    it('should return correct stats', () => {
      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      expect(result.current.getHistoryStats()).toEqual({
        undoCount: 0,
        redoCount: 0,
      })

      act(() => {
        result.current.pushHistory('content 1')
      })
      expect(result.current.getHistoryStats().undoCount).toBe(1)

      act(() => {
        result.current.pushHistory('content 2')
      })
      expect(result.current.getHistoryStats().undoCount).toBe(2)
    })
  })

  describe('integration scenarios', () => {
    it('should handle typical editing workflow', () => {
      let currentContent = ''
      mockGetContent = vi.fn(() => currentContent)

      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      // User types "Hello"
      currentContent = 'Hello'
      act(() => {
        result.current.pushHistory('Hello')
      })

      // User types " World"
      currentContent = 'Hello World'
      act(() => {
        result.current.pushHistory('Hello World')
      })

      // User presses Ctrl+Z (undo)
      mockSetContent.mockClear()
      act(() => {
        result.current.undo()
      })
      // Content should be back to "Hello"
      expect(mockSetContent).toHaveBeenLastCalledWith('Hello')

      // User presses Ctrl+Z again
      mockSetContent.mockClear()
      currentContent = 'Hello'
      act(() => {
        result.current.undo()
      })
      // Should be back to initial (no more undo available after this)
      // But we pushed 'Hello' so it should return 'Hello'
      expect(mockSetContent).toHaveBeenLastCalledWith('Hello')

      // User presses Ctrl+Shift+Z (redo)
      mockSetContent.mockClear()
      currentContent = 'Hello'
      act(() => {
        result.current.redo()
      })
      expect(mockSetContent).toHaveBeenLastCalledWith('Hello')
    })

    it('should clear redo stack when new edit after undo', () => {
      let currentContent = 'third'
      mockGetContent = vi.fn(() => currentContent)

      const { result } = renderHook(() => useHistory(mockGetContent, mockSetContent, mockSetDirty))

      // Setup
      act(() => {
        result.current.pushHistory('first')
        result.current.pushHistory('second')
        result.current.pushHistory('third')
      })

      // Undo
      act(() => {
        currentContent = 'third'
        result.current.undo()
      })

      expect(result.current.canRedo()).toBe(true)

      // New edit (simulating user typing after undo)
      act(() => {
        currentContent = 'modified second'
        result.current.pushHistory('modified second')
      })

      // Redo should not be available anymore
      expect(result.current.canRedo()).toBe(false)
    })
  })
})
