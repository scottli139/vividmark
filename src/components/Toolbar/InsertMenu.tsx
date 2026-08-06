import { useTranslation } from 'react-i18next'
import { Dropdown } from '../Menu'
import type { MenuItem } from '../Menu'

interface InsertMenuProps {
  onImage: () => void
  onTable: () => void
  onCodeBlock: () => void
  onAdmonition: () => void
}

export function InsertMenu({ onImage, onTable, onCodeBlock, onAdmonition }: InsertMenuProps) {
  const { t } = useTranslation()

  const handlers: Record<string, () => void> = {
    image: onImage,
    table: onTable,
    codeblock: onCodeBlock,
    admonition: onAdmonition,
  }

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
    },
    {
      id: 'admonition',
      label: t('toolbar.tooltip.admonition'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      ),
    },
  ]

  return (
    <Dropdown
      items={menuItems}
      onSelect={(id) => handlers[id]?.()}
      title={t('toolbar.tooltip.insert')}
      widthClass="w-44"
      trigger={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      }
    />
  )
}
