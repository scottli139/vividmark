import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { admonitionTypes, getAdmonitionDisplayTitle } from '../lib/markdown/admonitionTypes'

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
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleInsert()
      }
    },
    [onClose, handleInsert]
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-xl p-6 w-96">
        <h3 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">
          {t('dialog.insertAdmonition')}
        </h3>

        <div className="space-y-4">
          {/* 类型选择（迷你预览网格） */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              {t('dialog.admonitionType')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {admonitionTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  aria-pressed={selectedType === type}
                  className={`admonition ${type} text-left cursor-pointer transition-shadow ${
                    selectedType === type
                      ? 'outline-2 outline-solid outline-offset-1 outline-[var(--accent-color)]'
                      : ''
                  }`}
                  style={{ margin: 0 }}
                >
                  <div
                    className="admonition-title"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  >
                    {getAdmonitionDisplayTitle(type, '')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 自定义标题（可选） */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t('dialog.admonitionTitle')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-8 px-2 rounded border border-[var(--editor-border)] bg-[var(--editor-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
            />
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--editor-border)]/50 transition-colors"
          >
            {t('dialog.cancel')}
          </button>
          <button
            onClick={handleInsert}
            className="px-4 py-2 rounded text-sm font-medium bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity"
          >
            {t('dialog.insert')}
          </button>
        </div>
      </div>
    </div>
  )
}
