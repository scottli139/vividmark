import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface InsertMenuProps {
  onImage: () => void
  onTable: () => void
  onCodeBlock: () => void
}

interface MenuItem {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
}

export function InsertMenu({ onImage, onTable, onCodeBlock }: InsertMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const menuItems: MenuItem[] = [
    {
      id: 'image',
      label: t('toolbar.tooltip.insertImage'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      onClick: onImage,
    },
    {
      id: 'table',
      label: t('toolbar.tooltip.insertTable'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9h18" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 14h18" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 4v16" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 4v16" />
        </svg>
      ),
      onClick: onTable,
    },
    {
      id: 'codeblock',
      label: t('toolbar.tooltip.codeBlock'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      onClick: onCodeBlock,
    },
  ]

  const handleItemClick = (item: MenuItem) => {
    item.onClick()
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
        title={t('toolbar.tooltip.insert')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-lg py-1 z-50">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--editor-border)]/50 transition-colors text-left"
            >
              <span className="text-[var(--color-text-secondary)]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
