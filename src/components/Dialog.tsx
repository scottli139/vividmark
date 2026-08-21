import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialogStore } from '../stores/dialogStore'

/**
 * 自绘确认/提示弹窗（替代原生 confirm/alert）
 * 视觉对齐 TableDialog：overlay + --editor-bg 卡片 + accent 主按钮。
 * 交互：Esc/点 overlay = 取消（关闭），Enter = 确认；打开时焦点在主按钮。
 */
export function Dialog() {
  const { t } = useTranslation()
  const current = useDialogStore((state) => state.current)
  const answer = useDialogStore((state) => state.answer)
  const primaryButtonRef = useRef<HTMLButtonElement>(null)

  // 打开时焦点放主按钮（每次新对话框重新聚焦）
  useEffect(() => {
    primaryButtonRef.current?.focus()
  }, [current])

  if (!current) return null

  const isConfirm = current.kind === 'confirm'

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      answer(false)
    } else if (e.key === 'Enter') {
      answer(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          answer(false)
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-xl p-6 w-80">
        <p className="text-sm text-[var(--text-primary)]">{current.message}</p>

        <div className="flex justify-end gap-2 mt-6">
          {isConfirm && (
            <button
              onClick={() => answer(false)}
              className="px-4 py-2 rounded text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--editor-border)]/50 transition-colors"
            >
              {current.cancelLabel ?? t('dialog.cancel')}
            </button>
          )}
          <button
            ref={primaryButtonRef}
            onClick={() => answer(true)}
            className="px-4 py-2 rounded text-sm font-medium bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity"
          >
            {current.confirmLabel ?? (isConfirm ? t('dialog.confirm') : t('dialog.close'))}
          </button>
        </div>
      </div>
    </div>
  )
}
