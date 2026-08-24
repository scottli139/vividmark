import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MenuPanel } from './MenuPanel'
import type { MenuItem } from './MenuPanel'

interface DropdownProps {
  items: MenuItem[]
  onSelect: (id: string) => void
  /** 触发按钮内容（图标 / 文本节点） */
  trigger: ReactNode
  /** 触发按钮 title（tooltip） */
  title?: string
  /** 面板对齐方式，right 供工具栏右侧菜单使用 */
  align?: 'left' | 'right'
  /** 向上弹出（状态栏等底部场景） */
  openUp?: boolean
  /** 面板宽度类名，如 w-48 */
  widthClass?: string
  /** 触发按钮自定义类名；提供时替代默认的 p-1.5 内边距（状态栏等矮容器需要更小的纵向 padding） */
  triggerClassName?: string
}

/** 触发按钮 + MenuPanel 的自绘下拉：内部管理开关，外部点击 / Escape 关闭，选择后关闭 */
export function Dropdown({
  items,
  onSelect,
  trigger,
  title,
  align = 'left',
  openUp = false,
  widthClass,
  triggerClassName,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 点击外部 / Escape 关闭菜单
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (id: string) => {
    onSelect(id)
    setIsOpen(false)
  }

  const panelClassName =
    `absolute ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} ${align === 'right' ? 'right-0' : 'left-0'}` +
    (widthClass ? ` ${widthClass}` : '')

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-md hover:bg-[var(--hover-bg)] transition-colors ${triggerClassName ?? 'p-1.5'}`}
        title={title}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {trigger}
      </button>

      {isOpen && <MenuPanel items={items} onSelect={handleSelect} className={panelClassName} />}
    </div>
  )
}
