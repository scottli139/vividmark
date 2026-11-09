import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialogStore } from '../stores/dialogStore'
import { Button, Modal } from './ui'

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
    if (e.key === 'Enter') answer(true)
  }

  return (
    <Modal
      onClose={() => answer(false)}
      onKeyDown={handleKeyDown}
      className="w-80"
      aria-label={current.message}
    >
      <p className="text-sm text-foreground">{current.message}</p>

      <div className="mt-6 flex justify-end gap-2">
        {isConfirm && (
          <Button variant="ghost" onClick={() => answer(false)}>
            {current.cancelLabel ?? t('dialog.cancel')}
          </Button>
        )}
        <Button ref={primaryButtonRef} onClick={() => answer(true)}>
          {current.confirmLabel ?? (isConfirm ? t('dialog.confirm') : t('dialog.close'))}
        </Button>
      </div>
    </Modal>
  )
}
