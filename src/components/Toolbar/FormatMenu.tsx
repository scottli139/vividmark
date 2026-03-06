import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormatType } from '../../hooks/useTextFormat'

interface FormatMenuProps {
  onFormat: (format: FormatType) => void
}

interface MenuItem {
  format: FormatType
  label: string
  shortcut?: string
  icon: React.ReactNode
  divider?: boolean
}

export function FormatMenu({ onFormat }: FormatMenuProps) {
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

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  const menuItems: MenuItem[] = [
    {
      format: 'strike',
      label: t('toolbar.tooltip.strikethrough'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 12H7m10 0a4 4 0 01-4 4H9m8-4a4 4 0 00-4-4H9"
          />
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth={2} />
        </svg>
      ),
    },
    {
      format: 'code',
      label: t('toolbar.tooltip.inlineCode'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      ),
    },
    {
      format: 'orderedList',
      label: t('toolbar.tooltip.orderedList'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h12M7 12h12M7 17h12" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h.01M3 12h.01M3 17h.01" />
        </svg>
      ),
    },
    {
      format: 'tasklist',
      label: t('toolbar.tooltip.tasklist'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="5" width="4" height="4" rx="1" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 7h10" />
          <rect x="3" y="12" width="4" height="4" rx="1" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 14h10" />
        </svg>
      ),
    },
    {
      format: 'quote',
      label: t('toolbar.tooltip.quote'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
      ),
      divider: true,
    },
    {
      format: 'link',
      label: t('toolbar.tooltip.link'),
      shortcut: `${cmdKey}+K`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      ),
    },
  ]

  const handleItemClick = (format: FormatType) => {
    onFormat(format)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
        title={t('toolbar.tooltip.moreFormatting')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-lg py-1 z-50">
          {menuItems.map((item, index) => (
            <div key={item.format}>
              {item.divider && index > 0 && (
                <div className="border-t border-[var(--editor-border)] my-1" />
              )}
              <button
                onClick={() => handleItemClick(item.format)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--editor-border)]/50 transition-colors text-left"
              >
                <span className="text-[var(--color-text-secondary)]">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-[var(--color-text-secondary)]">{item.shortcut}</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
