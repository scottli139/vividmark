import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { createLogger } from '../../lib/logger'

const logger = createLogger('WindowControls')

/**
 * Linux 无边框窗口的自绘窗口控制按钮（最小化 / 最大化切换 / 关闭）。
 * 仅 Linux 桌面端由 Toolbar 挂载（窗口 decorations 已在 Rust 侧关闭）；
 * macOS 用系统红绿灯，Windows 保留原生标题栏。
 * 关闭走 win.close() → 触发 CloseRequested → windowManager 的脏确认拦截，
 * 与系统标题栏关闭按钮同一条路径。
 */
export function WindowControls() {
  const { t } = useTranslation()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const win = getCurrentWindow()
    const syncMaximized = () => {
      win
        .isMaximized()
        .then(setIsMaximized)
        .catch((e) => logger.warn('isMaximized failed:', e))
    }
    syncMaximized()
    let unlisten: (() => void) | undefined
    win
      .onResized(syncMaximized)
      .then((u) => (unlisten = u))
      .catch((e) => logger.warn('onResized listen failed:', e))
    return () => unlisten?.()
  }, [])

  const run = (action: 'minimize' | 'toggleMaximize' | 'close') => () => {
    const win = getCurrentWindow()
    win[action]().catch((e) => logger.warn(`${action} failed:`, e))
  }

  const buttonClass =
    'h-7 w-9 flex items-center justify-center rounded text-[var(--color-text-secondary)] transition-colors'

  return (
    <div className="flex items-center ml-1 pl-1 border-l border-[var(--editor-border)]">
      <button
        type="button"
        onClick={run('minimize')}
        title={t('toolbar.tooltip.minimize')}
        aria-label={t('toolbar.tooltip.minimize')}
        className={`${buttonClass} hover:bg-[var(--hover-bg)]`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
          <path d="M1 6h10" strokeWidth="1.2" />
        </svg>
      </button>
      <button
        type="button"
        onClick={run('toggleMaximize')}
        title={isMaximized ? t('toolbar.tooltip.restore') : t('toolbar.tooltip.maximize')}
        aria-label={isMaximized ? t('toolbar.tooltip.restore') : t('toolbar.tooltip.maximize')}
        className={`${buttonClass} hover:bg-[var(--hover-bg)]`}
      >
        {isMaximized ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
            <rect x="2.5" y="4.5" width="7" height="7" strokeWidth="1.2" />
            <path d="M4.5 4.5v-2h7v7h-2" strokeWidth="1.2" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
            <rect x="1.5" y="1.5" width="9" height="9" strokeWidth="1.2" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={run('close')}
        title={t('toolbar.tooltip.close')}
        aria-label={t('toolbar.tooltip.close')}
        className={`${buttonClass} hover:bg-[#e81123] hover:text-white`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
          <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  )
}
