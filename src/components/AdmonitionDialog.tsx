import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { admonitionTypes, getAdmonitionDisplayTitle } from '../lib/markdown/admonitionTypes'
import { Button, Modal, TextField } from './ui'

interface AdmonitionDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (type: string, title: string) => void
}

/**
 * Admonition（提示框）插入对话框
 *
 * 类型选项直接复用 .admonition / .admonition-title 样式渲染成迷你预览
 * （颜色/图标与文档渲染完全一致，亮暗主题自动跟随）。
 */
export function AdmonitionDialog({ isOpen, onClose, onInsert }: AdmonitionDialogProps) {
  const { t } = useTranslation()
  const [selectedType, setSelectedType] = useState<string>('note')
  const [title, setTitle] = useState('')

  const handleInsert = useCallback(() => {
    onInsert(selectedType, title.trim())
    onClose()
    // 重置为默认值
    setSelectedType('note')
    setTitle('')
  }, [selectedType, title, onInsert, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleInsert()
    },
    [handleInsert]
  )

  if (!isOpen) return null

  return (
    <Modal
      onClose={onClose}
      onKeyDown={handleKeyDown}
      className="w-96"
      aria-label={t('dialog.insertAdmonition')}
    >
      <h3 className="mb-4 text-lg font-semibold text-foreground">{t('dialog.insertAdmonition')}</h3>

      <div className="space-y-4">
        {/* 类型选择（迷你预览网格） */}
        <div>
          <label className="mb-2 block text-sm font-medium text-secondary">
            {t('dialog.admonitionType')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {admonitionTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                aria-pressed={selectedType === type}
                className={`admonition ${type} cursor-pointer text-left transition-shadow ${
                  selectedType === type
                    ? 'outline-2 outline-solid outline-offset-1 outline-accent'
                    : ''
                }`}
                style={{ margin: 0 }}
              >
                <div className="admonition-title px-2.5 py-1.5 text-xs">
                  {getAdmonitionDisplayTitle(type, '')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 自定义标题（可选） */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t('dialog.admonitionTitle')}
          </label>
          <TextField
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t('dialog.admonitionTitle')}
          />
        </div>
      </div>

      {/* 按钮 */}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('dialog.cancel')}
        </Button>
        <Button onClick={handleInsert}>{t('dialog.insert')}</Button>
      </div>
    </Modal>
  )
}
