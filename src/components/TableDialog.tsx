import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, TextField } from './ui'

interface TableDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (rows: number, cols: number) => void
}

export function TableDialog({ isOpen, onClose, onInsert }: TableDialogProps) {
  const { t } = useTranslation()
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)

  const handleInsert = useCallback(() => {
    onInsert(Math.max(1, rows), Math.max(1, cols))
    onClose()
    // 重置为默认值
    setRows(3)
    setCols(3)
  }, [rows, cols, onInsert, onClose])

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
      className="w-80"
      aria-label={t('dialog.insertTable')}
    >
      <h3 className="mb-4 text-lg font-semibold text-foreground">{t('dialog.insertTable')}</h3>

      <div className="space-y-4">
        {/* 行数输入 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t('dialog.rows')}
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setRows(Math.max(1, rows - 1))}
              aria-label={t('dialog.decreaseRows')}
            >
              -
            </Button>
            <TextField
              type="number"
              min={1}
              max={50}
              value={rows}
              onChange={(e) => setRows(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="flex-1 text-center"
              aria-label={t('dialog.rows')}
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setRows(Math.min(50, rows + 1))}
              aria-label={t('dialog.increaseRows')}
            >
              +
            </Button>
          </div>
        </div>

        {/* 列数输入 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            {t('dialog.columns')}
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setCols(Math.max(1, cols - 1))}
              aria-label={t('dialog.decreaseColumns')}
            >
              -
            </Button>
            <TextField
              type="number"
              min={1}
              max={20}
              value={cols}
              onChange={(e) => setCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="flex-1 text-center"
              aria-label={t('dialog.columns')}
            />
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setCols(Math.min(20, cols + 1))}
              aria-label={t('dialog.increaseColumns')}
            >
              +
            </Button>
          </div>
        </div>

        {/* 预览 */}
        <div className="pt-2">
          <label className="mb-2 block text-sm font-medium text-secondary">
            {t('dialog.preview')}
          </label>
          <div className="overflow-x-auto rounded bg-[var(--editor-border)]/20 p-3">
            <TablePreview rows={rows} cols={cols} />
          </div>
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

/**
 * 表格预览组件
 */
function TablePreview({ rows, cols }: { rows: number; cols: number }) {
  const { t } = useTranslation()

  return (
    <table className="w-full text-xs text-[var(--text-secondary)]">
      <thead>
        <tr>
          {Array.from({ length: cols }, (_, i) => (
            <th
              key={`h-${i}`}
              className="border border-[var(--editor-border)] p-1 bg-[var(--editor-border)]/30"
            >
              {t('dialog.colHeader', { number: i + 1 })}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={`r-${r}`}>
            {Array.from({ length: cols }, (_, c) => (
              <td key={`c-${r}-${c}`} className="border border-[var(--editor-border)] p-1">
                &nbsp;
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
