import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { availableLanguages, type Language } from '../../i18n'
import type { ThemeMode } from '../../lib/theme'

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

  // Esc 关闭（仅在打开时监听）
  useEffect(() => {
    if (!isSettingsOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSettingsOpen, setSettingsOpen])

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSettingsOpen(false)
        }
      }}
    >
      <div className="bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-xl p-6 w-96">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-medium text-[var(--text-primary)]">
            {t('settings.title')}
          </h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
            title={t('settings.close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 外观 */}
        <section className="mb-5">
          <h3 className={sectionTitleClass}>{t('settings.appearance')}</h3>
          <div className="flex gap-0.5 bg-[var(--editor-border)]/30 rounded-lg p-0.5">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setThemeMode(option.value)}
                className={`flex-1 px-2 py-1 rounded text-sm transition-colors ${
                  themeMode === option.value
                    ? 'bg-[var(--active-bg)] shadow-sm text-[var(--color-text)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--editor-border)]/50 hover:text-[var(--color-text)]'
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
                className="flex items-center gap-2 px-1 py-1 rounded text-sm cursor-pointer hover:bg-[var(--editor-border)]/50 transition-colors"
              >
                <input
                  type="radio"
                  name="settings-language"
                  checked={language === lang.code}
                  onChange={() => handleLanguageChange(lang.code)}
                  className="accent-[var(--accent-color)]"
                />
                <span>{lang.name}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 侧栏 */}
        <section>
          <h3 className={sectionTitleClass}>{t('settings.sidebar')}</h3>
          <label className="flex items-center gap-2 px-1 py-1 rounded text-sm cursor-pointer hover:bg-[var(--editor-border)]/50 transition-colors">
            <input
              type="checkbox"
              checked={showSidebar}
              onChange={toggleSidebar}
              className="accent-[var(--accent-color)]"
            />
            <span>{t('settings.showSidebar')}</span>
          </label>
        </section>
      </div>
    </div>
  )
}
