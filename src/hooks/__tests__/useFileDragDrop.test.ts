import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useFileDragDrop, getDragDropMetrics } from '../useFileDragDrop'

// Mock Tauri API
const mockUnlisten = vi.fn()
let mockDragDropCallback:
  | ((event: { payload: { type: string; paths?: string[] } }) => void)
  | null = null

const mockOnDragDropEvent = vi.fn().mockImplementation((callback) => {
  mockDragDropCallback = callback
  return Promise.resolve(mockUnlisten)
})

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    label: 'main',
    onDragDropEvent: mockOnDragDropEvent,
  }),
}))

// Mock fileOps
const mockOpenFileByPath = vi.fn()
vi.mock('../../lib/fileOps', () => ({
  openFileByPath: (path: string) => mockOpenFileByPath(path),
}))

// Mock editorStore - 使用 factory 模式
const mockIsDirty = false
vi.mock('../../stores/editorStore', () => ({
  useEditorStore: () => ({ isDirty: mockIsDirty }),
}))

describe('useFileDragDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDragDropCallback = null
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should setup drag drop listener on mount', async () => {
    renderHook(() => useFileDragDrop())

    // Fast-forward past the initialization delay (1000ms)
    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => {
      expect(mockOnDragDropEvent).toHaveBeenCalled()
    })
  })

  it('should show overlay on drag enter', async () => {
    const { result } = renderHook(() => useFileDragDrop())

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(mockOnDragDropEvent).toHaveBeenCalled())

    // Simulate drag enter via the captured callback
    act(() => {
      mockDragDropCallback?.({
        payload: {
          type: 'enter',
          paths: ['/test/file.md'],
        },
      })
    })

    expect(result.current.isDragging).toBe(true)
    expect(result.current.fileName).toBe('file.md')
  })

  it('should hide overlay on drag leave', async () => {
    const { result } = renderHook(() => useFileDragDrop())

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(mockOnDragDropEvent).toHaveBeenCalled())

    // First enter
    act(() => {
      mockDragDropCallback?.({
        payload: {
          type: 'enter',
          paths: ['/test/file.md'],
        },
      })
    })

    expect(result.current.isDragging).toBe(true)

    // Then leave
    act(() => {
      mockDragDropCallback?.({
        payload: {
          type: 'leave',
        },
      })
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.fileName).toBeNull()
  })

  it('should open file on drop', async () => {
    mockOpenFileByPath.mockResolvedValue(true)

    const { result } = renderHook(() => useFileDragDrop())

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(mockOnDragDropEvent).toHaveBeenCalled())

    act(() => {
      mockDragDropCallback?.({
        payload: {
          type: 'drop',
          paths: ['/test/document.md'],
        },
      })
    })

    await waitFor(() => {
      expect(mockOpenFileByPath).toHaveBeenCalledWith('/test/document.md')
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('should reject invalid file types', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    renderHook(() => useFileDragDrop())

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(mockOnDragDropEvent).toHaveBeenCalled())

    act(() => {
      mockDragDropCallback?.({
        payload: {
          type: 'drop',
          paths: ['/test/image.png'],
        },
      })
    })

    expect(alertSpy).toHaveBeenCalledWith('Please drop a Markdown file (.md, .markdown, .txt)')
    expect(mockOpenFileByPath).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it('should handle drop with multiple files (use first one)', async () => {
    mockOpenFileByPath.mockResolvedValue(true)

    renderHook(() => useFileDragDrop())

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(mockOnDragDropEvent).toHaveBeenCalled())

    act(() => {
      mockDragDropCallback?.({
        payload: {
          type: 'drop',
          paths: ['/test/first.md', '/test/second.md'],
        },
      })
    })

    await waitFor(() => {
      expect(mockOpenFileByPath).toHaveBeenCalledWith('/test/first.md')
      expect(mockOpenFileByPath).toHaveBeenCalledTimes(1)
    })
  })

  it('should cleanup listener on unmount', async () => {
    const { unmount } = renderHook(() => useFileDragDrop())

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(mockOnDragDropEvent).toHaveBeenCalled())

    unmount()

    expect(mockUnlisten).toHaveBeenCalled()
  })

  it('should handle file open failure gracefully', async () => {
    mockOpenFileByPath.mockRejectedValue(new Error('File not found'))
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    renderHook(() => useFileDragDrop())

    await act(async () => {
      vi.advanceTimersByTime(1100)
    })

    await waitFor(() => expect(mockOnDragDropEvent).toHaveBeenCalled())

    act(() => {
      mockDragDropCallback?.({
        payload: {
          type: 'drop',
          paths: ['/test/missing.md'],
        },
      })
    })

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to open file')
    })

    alertSpy.mockRestore()
  })
})

describe('getDragDropMetrics', () => {
  it('should return metrics object', () => {
    const metrics = getDragDropMetrics()

    expect(metrics).toHaveProperty('dragEnterCount')
    expect(metrics).toHaveProperty('dropCount')
    expect(metrics).toHaveProperty('successCount')
    expect(metrics).toHaveProperty('errorCount')
  })

  it('should return independent copies', () => {
    const metrics1 = getDragDropMetrics()
    const metrics2 = getDragDropMetrics()

    expect(metrics1).toEqual(metrics2)
    expect(metrics1).not.toBe(metrics2)
  })
})
