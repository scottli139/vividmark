import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { availableLanguages, type Language } from '../../i18n'
import type { ThemeMode } from '../../lib/theme'
import { Button, Modal } from '../ui'

/**
 * 设置面板（最小可用）：外观主题 / 语言 / 侧栏显隐。
 * 视觉对齐 Dialog：overlay + --editor-bg 卡片；Esc / 点 overlay / 右上角 × 关闭。
 */
export function SettingsDialog() {
  const { t, i18n } = useTranslation()
  const {
    isSettingsOpen,
    themeMode,
    language,
    showSidebar,
    setSettingsOpen,
    setThemeMode,
    setLanguage,
    toggleSidebar,
  } = useEditorStore()

  if (!isSettingsOpen) return null

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'system', label: t('settings.theme.system') },
  ]

  const sectionTitleClass = 'text-xs font-medium text-[var(--color-text-secondary)] mb-2'

  return (
    <Modal onClose={() => setSettingsOpen(false)} className="w-96" aria-label={t('settings.title')}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-medium text-foreground">{t('settings.title')}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(false)}
          title={t('settings.close')}
          aria-label={t('settings.close')}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>

      {/* 外观 */}
      <section className="mb-5">
        <h3 className={sectionTitleClass}>{t('settings.appearance')}</h3>
        <div className="flex gap-0.5 rounded-lg bg-[var(--editor-border)]/30 p-0.5">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setThemeMode(option.value)}
              className={`flex-1 rounded px-2 py-1 text-sm transition-colors ${
                themeMode === option.value
                  ? 'bg-active text-foreground shadow-sm'
                  : 'text-secondary hover:bg-hover hover:text-foreground'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* 语言 */}
      <section className="mb-5">
        <h3 className={sectionTitleClass}>{t('settings.language')}</h3>
        <div className="flex flex-col gap-1">
          {availableLanguages.map((lang) => (
            <label
              key={lang.code}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm transition-colors hover:bg-hover"
            >
              <input
                type="radio"
                name="settings-language"
                checked={language === lang.code}
                onChange={() => handleLanguageChange(lang.code)}
                className="accent-accent"
              />
              <span>{lang.name}</span>
            </label>
          ))}
        </div>
      </section>

      {/* 侧栏 */}
      <section>
        <h3 className={sectionTitleClass}>{t('settings.sidebar')}</h3>
        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm transition-colors hover:bg-hover">
          <input
            type="checkbox"
            checked={showSidebar}
            onChange={toggleSidebar}
            className="accent-accent"
          />
          <span>{t('settings.showSidebar')}</span>
        </label>
      </section>
    </Modal>
  )
}
