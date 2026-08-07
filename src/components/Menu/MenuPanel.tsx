import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

export interface MenuActionItem {
  id: string
  label: string
  icon?: ReactNode
  /** 图标容器附加类名（如 HeadingDropdown 的 text-xs font-mono w-8） */
  iconClassName?: string
  shortcut?: string
  /** 传入（含 false）时左侧渲染勾选槽位，true 显示 ✓ */
  checked?: boolean
  disabled?: boolean
}

export interface MenuDividerItem {
  divider: true
}

/** 子菜单项：hover/点击展开右侧面板（溢出视口时翻到左侧/向上收拢），仅支持一层嵌套 */
export interface MenuSubmenuItem {
  id: string
  label: string
  icon?: ReactNode
  iconClassName?: string
  disabled?: boolean
  children: MenuItem[]
}

export type MenuItem = MenuActionItem | MenuDividerItem | MenuSubmenuItem

function isDividerItem(item: MenuItem): item is MenuDividerItem {
  return 'divider' in item
}

function isSubmenuItem(item: MenuItem): item is MenuSubmenuItem {
  return 'children' in item
}

/** 子菜单面板估算行高（px，与按钮 py-1 + text-sm 一致），用于垂直溢出修正 */
const SUBMENU_ROW_HEIGHT = 28
/** 子菜单面板估算宽度（px，与 min-w-40 一致），用于水平翻转判断 */
const SUBMENU_WIDTH = 160

interface SubmenuProps {
  item: MenuSubmenuItem
  open: boolean
  onOpen: () => void
  onSelect: (id: string) => void
}

/** 单条子菜单：触发行 + 悬停展开的面板（面板挂在触发行容器内，hover 移动无间隙） */
function Submenu({ item, open, onOpen, onSelect }: SubmenuProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: boolean; top: number }>({
    left: false,
    top: 0,
  })

  // 展开时按触发行位置修正：右侧放不下则翻到左侧；底部溢出则向上收拢
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const estimatedHeight = item.children.length * SUBMENU_ROW_HEIGHT + 12
    setPosition({
      left: rect.right + SUBMENU_WIDTH > window.innerWidth,
      top: Math.min(0, window.innerHeight - (rect.top + estimatedHeight)),
    })
  }, [open, item.children.length])

  return (
    <div ref={triggerRef} className="relative" onMouseEnter={onOpen}>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={item.disabled}
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-3 py-1 text-sm hover:bg-[var(--editor-border)]/50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {item.icon && (
          <span
            className={`text-[var(--color-text-secondary)]${
              item.iconClassName ? ` ${item.iconClassName}` : ''
            }`}
          >
            {item.icon}
          </span>
        )}
        <span className="flex-1">{item.label}</span>
        <svg
          className="w-3 h-3 text-[var(--color-text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        // -ml-1 让面板与触发行轻微重叠，鼠标平移不丢失 hover
        <div
          role="menu"
          className={`absolute min-w-40 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-lg py-1 z-50 ${
            position.left ? 'right-full -mr-1' : 'left-full -ml-1'
          }`}
          style={{ top: position.top }}
        >
          <MenuItems items={item.children} onSelect={onSelect} />
        </div>
      )}
    </div>
  )
}

interface MenuItemsProps {
  items: MenuItem[]
  onSelect: (id: string) => void
  openSubmenuId?: string | null
  onOpenSubmenu?: (id: string | null) => void
}

/** 菜单项列表渲染（MenuPanel 主体与子菜单面板共用） */
function MenuItems({ items, onSelect, openSubmenuId, onOpenSubmenu }: MenuItemsProps) {
  return (
    <>
      {items.map((item, index) =>
        isDividerItem(item) ? (
          <div
            key={`divider-${index}`}
            role="separator"
            className="border-t border-[var(--editor-border)] my-1"
            onMouseEnter={() => onOpenSubmenu?.(null)}
          />
        ) : isSubmenuItem(item) ? (
          <Submenu
            key={item.id}
            item={item}
            open={openSubmenuId === item.id}
            onOpen={() => onOpenSubmenu?.(item.id)}
            onSelect={onSelect}
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked === undefined ? undefined : item.checked}
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            onMouseEnter={() => onOpenSubmenu?.(null)}
            className="w-full flex items-center gap-3 px-3 py-1 text-sm hover:bg-[var(--editor-border)]/50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {item.checked !== undefined && (
              <span className="w-4 text-center text-[var(--color-text-secondary)]">
                {item.checked ? '✓' : ''}
              </span>
            )}
            {item.icon && (
              <span
                className={`text-[var(--color-text-secondary)]${
                  item.iconClassName ? ` ${item.iconClassName}` : ''
                }`}
              >
                {item.icon}
              </span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-xs text-[var(--color-text-secondary)]">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </>
  )
}

interface MenuPanelProps {
  items: MenuItem[]
  onSelect: (id: string) => void
  /** 定位与宽度类名，由调用方传入（Dropdown 用 absolute 相对定位，ContextMenu 用 fixed 坐标） */
  className?: string
  style?: CSSProperties
}

/** 纯展示的菜单面板：渲染菜单项列表（含一层子菜单），定位交给调用方 */
export function MenuPanel({ items, onSelect, className, style }: MenuPanelProps) {
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)

  return (
    <div
      role="menu"
      className={`bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-lg py-1 z-50${
        className ? ` ${className}` : ''
      }`}
      style={style}
      // 鼠标离开整个面板时收起子菜单
      onMouseLeave={() => setOpenSubmenuId(null)}
    >
      <MenuItems
        items={items}
        onSelect={onSelect}
        openSubmenuId={openSubmenuId}
        onOpenSubmenu={setOpenSubmenuId}
      />
    </div>
  )
}
