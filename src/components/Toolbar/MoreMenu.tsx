import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Dropdown } from '../Menu'
import type { MenuItem } from '../Menu'
import { useEditorStore } from '../../stores/editorStore'
import { availableLanguages, type Language } from '../../i18n'
import { exportSite } from '../../lib/exportSite'
import { isTauri } from '../../lib/imageSrc'

/** 工具栏右侧「更多」菜单：缩放 / 导出 PDF / 导出网站 / 语言 / 设置入口 */
export function MoreMenu() {
  const { t, i18n } = useTranslation()
  const { language, zoomIn, zoomOut, zoomReset, setLanguage, setSettingsOpen, openedFolder } =
    useEditorStore()

  // 检测是否为 Mac
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  const handleLanguageChange = useCallback(
    (lang: Language) => {
      setLanguage(lang)
      i18n.changeLanguage(lang)
    },
    [setLanguage, i18n]
  )

  const handleSelect = (id: string) => {
    switch (id) {
      case 'zoom-in':
        zoomIn()
        break
      case 'zoom-out':
        zoomOut()
        break
      case 'zoom-reset':
        zoomReset()
        break
      case 'export-pdf':
        // 由 Editor 监听并执行导出
        window.dispatchEvent(new CustomEvent('editor-export-pdf'))
        break
      case 'export-site':
        void exportSite()
        break
      case 'settings':
        setSettingsOpen(true)
        break
      default:
        if (id.startsWith('lang-')) {
          handleLanguageChange(id.slice('lang-'.length) as Language)
        }
    }
  }

  const menuItems: MenuItem[] = [
    { id: 'zoom-in', label: t('toolbar.tooltip.zoomIn', { shortcut: `${cmdKey}+=` }) },
    { id: 'zoom-out', label: t('toolbar.tooltip.zoomOut', { shortcut: `${cmdKey}+-` }) },
    { id: 'zoom-reset', label: t('toolbar.tooltip.zoomReset', { shortcut: `${cmdKey}+Shift+0` }) },
    { divider: true },
    { id: 'export-pdf', label: t('toolbar.tooltip.exportPdf', { shortcut: `${cmdKey}+P` }) },
    {
      id: 'export-site',
      label: t('toolbar.tooltip.exportSite'),
      disabled: !openedFolder || !isTauri(),
    },
    { divider: true },
    ...availableLanguages.map<MenuItem>((lang) => ({
      id: `lang-${lang.code}`,
      label: lang.label,
      checked: language === lang.code,
    })),
    { divider: true },
    { id: 'settings', label: t('settings.title') },
  ]

  return (
    <Dropdown
      items={menuItems}
      onSelect={handleSelect}
      title={t('toolbar.more')}
      align="right"
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
