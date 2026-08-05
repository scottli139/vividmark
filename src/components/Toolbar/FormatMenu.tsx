import { useTranslation } from 'react-i18next'
import { Dropdown } from '../Menu'
import type { MenuItem } from '../Menu'
import type { FormatType } from '../../lib/markdownEditing'

interface FormatMenuProps {
  onFormat: (format: FormatType) => void
}

export function FormatMenu({ onFormat }: FormatMenuProps) {
  const { t } = useTranslation()

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  const menuItems: MenuItem[] = [
    {
      id: 'strike',
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
      id: 'code',
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
      id: 'tasklist',
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
    { divider: true },
    {
      id: 'quote',
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
    },
    {
      id: 'link',
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

  return (
    <Dropdown
      items={menuItems}
      onSelect={(id) => onFormat(id as FormatType)}
      title={t('toolbar.tooltip.moreFormatting')}
      widthClass="w-48"
      trigger={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      }
    />
  )
}
