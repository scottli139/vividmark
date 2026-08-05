import { useTranslation } from 'react-i18next'
import { Dropdown } from '../Menu'
import type { MenuItem } from '../Menu'

interface HeadingDropdownProps {
  onSelect: (level: 1 | 2 | 3) => void
}

export function HeadingDropdown({ onSelect }: HeadingDropdownProps) {
  const { t } = useTranslation()

  const menuItems: MenuItem[] = [
    {
      id: '1',
      label: t('toolbar.tooltip.heading1'),
      shortcut: 'Ctrl+1',
      icon: '# ',
      iconClassName: 'text-xs font-mono w-8',
    },
    {
      id: '2',
      label: t('toolbar.tooltip.heading2'),
      shortcut: 'Ctrl+2',
      icon: '## ',
      iconClassName: 'text-xs font-mono w-8',
    },
    {
      id: '3',
      label: t('toolbar.tooltip.heading3'),
      shortcut: 'Ctrl+3',
      icon: '### ',
      iconClassName: 'text-xs font-mono w-8',
    },
  ]

  return (
    <Dropdown
      items={menuItems}
      onSelect={(id) => onSelect(Number(id) as 1 | 2 | 3)}
      title={t('toolbar.tooltip.heading')}
      widthClass="w-40"
      triggerClassName="flex items-center gap-0.5"
      trigger={
        <>
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
        </>
      }
    />
  )
}
