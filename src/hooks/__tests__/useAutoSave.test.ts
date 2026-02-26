import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'
import { useEditorStore } from '../../stores/editorStore'

// Mock fileOps module
vi.mock('../../lib/fileOps', () => ({
  saveFile: vi.fn(),
}))

// Import the mocked saveFile
import { saveFile } from '../../lib/fileOps'
const mockSaveFile = vi.mocked(saveFile)

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockSaveFile.mockReset()

    // Reset store state directly
    useEditorStore.setState({
      content: '',
      filePath: null,
      fileName: 'Untitled.md',
      isDirty: false,
      recentFiles: [],
      isDarkMode: false,
      showSidebar: true,
      viewMode: 'source',
      activeBlockId: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not save when there is no file path', async () => {
    act(() => {
      useEditorStore.setState({
        filePath: null,
        isDirty: true,
        content: 'test content',
      })
    })

    renderHook(() => useAutoSave())

    // Advance timers past the auto-save delay
    await act(async () => {
      vi.advanceTimersByTimeAsync(3000)
    })

    expect(mockSaveFile).not.toHaveBeenCalled()
  })

  it('should not save when document is not dirty', async () => {
    act(() => {
      useEditorStore.setState({
        filePath: '/test/file.md',
        isDirty: false,
        content: 'test content',
      })
    })

    renderHook(() => useAutoSave())

    await act(async () => {
      vi.advanceTimersByTimeAsync(3000)
    })

    expect(mockSaveFile).not.toHaveBeenCalled()
  })

  it('should trigger auto-save after delay when file path exists and is dirty', async () => {
    mockSaveFile.mockResolvedValue(true)

    act(() => {
      useEditorStore.setState({
        filePath: '/test/file.md',
        isDirty: true,
        content: 'test content',
      })
    })

    renderHook(() => useAutoSave())

    // Before auto-save delay
    expect(mockSaveFile).not.toHaveBeenCalled()

    // After 2 second delay
    await act(async () => {
      vi.advanceTimersByTimeAsync(2000)
    })

    expect(mockSaveFile).toHaveBeenCalledTimes(1)
  })

  it('should debounce multiple content changes', async () => {
    mockSaveFile.mockResolvedValue(true)

    act(() => {
      useEditorStore.setState({
        filePath: '/test/file.md',
        isDirty: false,
        content: '',
      })
    })

    renderHook(() => useAutoSave())

    // Multiple rapid content changes
    act(() => {
      useEditorStore.getState().setContent('change 1')
    })

    await act(async () => {
      vi.advanceTimersByTimeAsync(500)
    })

    act(() => {
      useEditorStore.getState().setContent('change 2')
    })

    await act(async () => {
      vi.advanceTimersByTimeAsync(500)
    })

    act(() => {
      useEditorStore.getState().setContent('change 3')
    })

    // No save should have happened yet
    expect(mockSaveFile).not.toHaveBeenCalled()

    // After full delay from last change
    await act(async () => {
      vi.advanceTimersByTimeAsync(2000)
    })

    // Should only save once
    expect(mockSaveFile).toHaveBeenCalledTimes(1)
  })

  it('should handle save errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSaveFile.mockRejectedValue(new Error('Save failed'))

    act(() => {
      useEditorStore.setState({
        filePath: '/test/file.md',
        isDirty: true,
        content: 'test content',
      })
    })

    renderHook(() => useAutoSave())

    await act(async () => {
      vi.advanceTimersByTimeAsync(2000)
    })

    expect(mockSaveFile).toHaveBeenCalled()
    // Logger formats the message with timestamp and module prefix
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AutoSave] ERROR: Auto-save failed:'),
      expect.any(Error)
    )

    consoleErrorSpy.mockRestore()
  })

  it('should not trigger concurrent saves', async () => {
    // Use a slow mock that takes time to resolve
    let resolveSave: () => void
    const savePromise = new Promise<boolean>((resolve) => {
      resolveSave = () => resolve(true)
    })
    mockSaveFile.mockReturnValue(savePromise)

    useEditorStore.setState({
      filePath: '/test/file.md',
      isDirty: true,
      content: 'test content',
    })

    renderHook(() => useAutoSave())

    // Trigger first save
    await act(async () => {
      vi.advanceTimersByTimeAsync(2000)
    })

    expect(mockSaveFile).toHaveBeenCalledTimes(1)

    // Try to trigger another save while first is pending
    useEditorStore.getState().setContent('more content')

    await act(async () => {
      vi.advanceTimersByTimeAsync(2000)
    })

    // Should still only have one save in progress (isSavingRef prevents concurrent saves)
    expect(mockSaveFile).toHaveBeenCalledTimes(1)

    // Resolve the first save
    resolveSave!()
    await act(async () => {
      vi.runAllTimersAsync()
    })

    // After first save completes, isSavingRef is set to false
    // The test verifies that concurrent saves are prevented while saving
    expect(mockSaveFile.mock.calls.length).toBeLessThanOrEqual(2)
  })

  it('should cleanup timer on unmount', async () => {
    mockSaveFile.mockResolvedValue(true)

    act(() => {
      useEditorStore.setState({
        filePath: '/test/file.md',
        isDirty: true,
        content: 'test content',
      })
    })

    const { unmount } = renderHook(() => useAutoSave())

    // Unmount before delay
    unmount()

    // Advance timers
    await act(async () => {
      vi.advanceTimersByTimeAsync(3000)
    })

    // Should not have saved after unmount
    expect(mockSaveFile).not.toHaveBeenCalled()
  })
})
