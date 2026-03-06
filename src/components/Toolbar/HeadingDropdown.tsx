import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface HeadingDropdownProps {
  onSelect: (level: 1 | 2 | 3) => void
}

export function HeadingDropdown({ onSelect }: HeadingDropdownProps) {
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

  const headings = [
    { level: 1 as const, label: t('toolbar.tooltip.heading1'), shortcut: 'Ctrl+1', prefix: '# ' },
    { level: 2 as const, label: t('toolbar.tooltip.heading2'), shortcut: 'Ctrl+2', prefix: '## ' },
    { level: 3 as const, label: t('toolbar.tooltip.heading3'), shortcut: 'Ctrl+3', prefix: '### ' },
  ]

  const handleSelect = (level: 1 | 2 | 3) => {
    onSelect(level)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded hover:bg-[var(--editor-border)]/50 transition-colors flex items-center gap-0.5"
        title={t('toolbar.tooltip.heading')}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-40 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-lg py-1 z-50">
          {headings.map((heading) => (
            <button
              key={heading.level}
              onClick={() => handleSelect(heading.level)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--editor-border)]/50 transition-colors text-left"
            >
              <span className="text-xs font-mono text-[var(--color-text-secondary)] w-8">
                {heading.prefix}
              </span>
              <span className="flex-1">{heading.label}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{heading.shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
