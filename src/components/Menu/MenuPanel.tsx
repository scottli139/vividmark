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

export type MenuItem = MenuActionItem | MenuDividerItem

function isDividerItem(item: MenuItem): item is MenuDividerItem {
  return 'divider' in item
}

interface MenuPanelProps {
  items: MenuItem[]
  onSelect: (id: string) => void
  /** 定位与宽度类名，由调用方传入（Dropdown 用 absolute 相对定位，ContextMenu 用 fixed 坐标） */
  className?: string
  style?: CSSProperties
}

/** 纯展示的菜单面板：渲染菜单项列表，定位交给调用方 */
export function MenuPanel({ items, onSelect, className, style }: MenuPanelProps) {
  return (
    <div
      role="menu"
      className={`bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-lg py-1 z-50${
        className ? ` ${className}` : ''
      }`}
      style={style}
    >
      {items.map((item, index) =>
        isDividerItem(item) ? (
          <div
            key={`divider-${index}`}
            role="separator"
            className="border-t border-[var(--editor-border)] my-1"
          />
        ) : (
          <button
            key={item.id}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked === undefined ? undefined : item.checked}
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--editor-border)]/50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
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
    </div>
  )
}
