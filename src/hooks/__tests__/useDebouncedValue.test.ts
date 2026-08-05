import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from '../useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return initial value immediately', () => {
    const { result } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'initial' },
    })

    expect(result.current).toBe('initial')
  })

  it('should update value after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'initial' },
    })

    rerender({ value: 'updated' })
    // 延迟未到，仍是旧值
    expect(result.current).toBe('initial')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('updated')
  })

  it('should debounce rapid changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ value: 'c' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // 第一次变化被第二次重置，200ms 内仍是旧值
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('c')
  })

  it('should use default delay of 200ms', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('should work with non-string values', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 100), {
      initialProps: { value: 42 },
    })

    rerender({ value: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe(100)
  })
})
