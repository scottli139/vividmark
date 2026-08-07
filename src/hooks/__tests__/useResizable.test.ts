import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useResizable } from '../useResizable'

/** 构造带 button 信息的 React 合成 mousedown（只用到 button/clientX/preventDefault） */
function mouseEvent(button: number) {
  return { button, clientX: 100, preventDefault: () => {} } as React.MouseEvent
}

describe('useResizable', () => {
  it('左键按下进入 resize，拖动调整宽度并 clamp 边界', () => {
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 224, minWidth: 180, maxWidth: 400 })
    )

    act(() => {
      result.current.handleMouseDown(mouseEvent(0))
    })
    expect(result.current.isResizing).toBe(true)

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 180 }))
    })
    expect(result.current.width).toBe(304)

    // 超出 maxWidth 被 clamp
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 }))
    })
    expect(result.current.width).toBe(400)

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup'))
    })
    expect(result.current.isResizing).toBe(false)
  })

  it('右键按下不进入 resize（侧栏边缘打开右键菜单不应触发调宽）', () => {
    const { result } = renderHook(() => useResizable({ initialWidth: 224 }))

    act(() => {
      result.current.handleMouseDown(mouseEvent(2))
    })
    expect(result.current.isResizing).toBe(false)

    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }))
    })
    expect(result.current.width).toBe(224)
  })
})
