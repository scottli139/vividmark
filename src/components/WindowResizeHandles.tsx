import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isLinuxDesktop } from '../lib/platform'
import { createLogger } from '../lib/logger'

const logger = createLogger('WindowResizeHandles')

// @tauri-apps/api 2.10 未导出 ResizeDirection，本地复刻（与 startResizeDragging 签名一致）
type ResizeDirection =
  | 'East'
  | 'North'
  | 'NorthEast'
  | 'NorthWest'
  | 'South'
  | 'SouthEast'
  | 'SouthWest'
  | 'West'

/**
 * Linux 无边框窗口的边缘缩放手柄：decorations 关闭后 WM 不再提供缩放边框，
 * 在窗口四边/四角铺透明热区，mousedown 后交给 WM 完成缩放（startResizeDragging
 * 内部走 gtk_window_begin_resize_drag，KWin 照常接管）。
 * 边条宽 4px、角 12px；最大化时隐藏（不可缩放，且避免遮挡滚动条/状态栏）。
 * 仅 Linux 桌面端渲染（macOS 有系统边框，Windows 保留原生标题栏）。
 */

interface Handle {
  dir: ResizeDirection
  className: string
}

const HANDLES: Handle[] = [
  { dir: 'North', className: 'top-0 left-3 right-3 h-1 cursor-n-resize' },
  { dir: 'South', className: 'bottom-0 left-3 right-3 h-1 cursor-s-resize' },
  { dir: 'West', className: 'left-0 top-3 bottom-3 w-1 cursor-w-resize' },
  { dir: 'East', className: 'right-0 top-3 bottom-3 w-1 cursor-e-resize' },
  { dir: 'NorthWest', className: 'top-0 left-0 w-3 h-3 cursor-nw-resize' },
  { dir: 'NorthEast', className: 'top-0 right-0 w-3 h-3 cursor-ne-resize' },
  { dir: 'SouthWest', className: 'bottom-0 left-0 w-3 h-3 cursor-sw-resize' },
  { dir: 'SouthEast', className: 'bottom-0 right-0 w-3 h-3 cursor-se-resize' },
]

export function WindowResizeHandles() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!isLinuxDesktop()) return
    const win = getCurrentWindow()
    const syncMaximized = () => {
      win
        .isMaximized()
        .then(setIsMaximized)
        .catch((e) => logger.warn('isMaximized failed:', e))
    }
    syncMaximized()
    let unlisten: (() => void) | undefined
    win
      .onResized(syncMaximized)
      .then((u) => (unlisten = u))
      .catch((e) => logger.warn('onResized listen failed:', e))
    return () => unlisten?.()
  }, [])

  if (!isLinuxDesktop() || isMaximized) return null

  const startResize = (dir: ResizeDirection) => (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    getCurrentWindow()
      .startResizeDragging(dir)
      .catch((err) => logger.warn('startResizeDragging failed:', err))
  }

  return (
    <>
      {HANDLES.map((h) => (
        <div
          key={h.dir}
          data-resize-direction={h.dir}
          onMouseDown={startResize(h.dir)}
          className={`absolute z-40 ${h.className}`}
        />
      ))}
    </>
  )
}
