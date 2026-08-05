import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MenuPanel } from './MenuPanel'
import type { MenuItem } from './MenuPanel'
import { resolveContextMenuPosition } from './menuPosition'

interface ContextMenuProps {
  /** 菜单锚点（视口坐标，通常为 contextmenu 事件的 clientX/clientY） */
  x: number
  y: number
  items: MenuItem[]
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * 受控右键菜单：fixed 定位在 (x, y) 处，溢出视口时翻转。
 * 外部点击 / Escape / 滚动 / 窗口缩放均触发 onClose；父组件通过条件渲染控制显隐。
 */
export function ContextMenu({ x, y, items, onSelect, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  // 挂载后按实际尺寸修正位置（溢出翻转）
  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const next = resolveContextMenuPosition(
      x,
      y,
      menu.offsetWidth,
      menu.offsetHeight,
      window.innerWidth,
      window.innerHeight
    )
    setPosition((prev) => (prev.left === next.left && prev.top === next.top ? prev : next))
  }, [x, y])

  // 外部点击 / Escape / 滚动 / 窗口缩放时关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const handleSelect = (id: string) => {
    onSelect(id)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed min-w-40"
      style={{ left: position.left, top: position.top }}
    >
      <MenuPanel items={items} onSelect={handleSelect} />
    </div>
  )
}
