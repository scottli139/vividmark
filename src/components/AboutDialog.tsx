import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-shell'
import { useEditorStore } from '../stores/editorStore'
import { isTauri } from '../lib/imageSrc'
import { createLogger } from '../lib/logger'

const logger = createLogger('AboutDialog')

const WEBSITE = 'https://github.com/scottli139/vividmark'

/**
 * About 对话框：原生菜单的 Predefined About 只存在于 macOS/Linux；
 * Windows 自绘菜单栏（及浏览器 dev）的 Help ▸ About 用本组件平替。
 * 视觉对齐 SettingsDialog：overlay + --editor-bg 卡片；Esc / 点 overlay 关闭。
 */
export function AboutDialog() {
  const { t } = useTranslation()
  const { isAboutOpen, setAboutOpen } = useEditorStore()
  const [version, setVersion] = useState('dev')

  // Esc 关闭（仅在打开时监听）
  useEffect(() => {
    if (!isAboutOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAboutOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isAboutOpen, setAboutOpen])

  // 版本号来自 Tauri app API（与 Cargo.toml/tauri.conf.json 同步）；浏览器回退 dev
  useEffect(() => {
    if (!isAboutOpen || !isTauri()) return
    import('@tauri-apps/api/app')
      .then((m) => m.getVersion())
      .then(setVersion)
      .catch((e) => logger.warn('getVersion failed:', e))
  }, [isAboutOpen])

  if (!isAboutOpen) return null

  const handleWebsite = () => {
    if (isTauri()) {
      void open(WEBSITE).catch((e) => logger.warn('Failed to open website:', e))
    } else {
      window.open(WEBSITE, '_blank', 'noopener')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) setAboutOpen(false)
      }}
    >
      <div className="bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-xl p-6 w-80 text-center">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">VividMark</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t('about.version', { version })}
        </p>
        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">{t('about.copyright')}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t('about.license')}</p>
        <button
          onClick={handleWebsite}
          className="mt-4 text-sm text-[var(--accent-color)] hover:underline"
        >
          {t('about.website')}
        </button>
        <div className="mt-5">
          <button
            onClick={() => setAboutOpen(false)}
            className="px-4 py-1.5 text-sm rounded-md bg-[var(--editor-border)]/50 hover:bg-[var(--editor-border)] transition-colors text-[var(--color-text)]"
          >
            {t('dialog.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
