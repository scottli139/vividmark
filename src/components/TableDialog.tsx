import { useState, useCallback } from 'react'

interface TableDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (rows: number, cols: number) => void
}

export function TableDialog({ isOpen, onClose, onInsert }: TableDialogProps) {
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
      <div className="bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-xl p-6 w-80">
        <h3 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">Insert Table</h3>

        <div className="space-y-4">
          {/* 行数输入 */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Rows (excluding header)
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRows(Math.max(1, rows - 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-[var(--editor-border)] hover:bg-[var(--editor-border)]/50 text-[var(--text-primary)]"
                aria-label="Decrease rows"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={50}
                value={rows}
                onChange={(e) => setRows(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                className="flex-1 h-8 px-2 text-center rounded border border-[var(--editor-border)] bg-[var(--editor-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
              <button
                onClick={() => setRows(Math.min(50, rows + 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-[var(--editor-border)] hover:bg-[var(--editor-border)]/50 text-[var(--text-primary)]"
                aria-label="Increase rows"
              >
                +
              </button>
            </div>
          </div>

          {/* 列数输入 */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Columns
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCols(Math.max(1, cols - 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-[var(--editor-border)] hover:bg-[var(--editor-border)]/50 text-[var(--text-primary)]"
                aria-label="Decrease columns"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={20}
                value={cols}
                onChange={(e) => setCols(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="flex-1 h-8 px-2 text-center rounded border border-[var(--editor-border)] bg-[var(--editor-bg)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
              />
              <button
                onClick={() => setCols(Math.min(20, cols + 1))}
                className="w-8 h-8 flex items-center justify-center rounded border border-[var(--editor-border)] hover:bg-[var(--editor-border)]/50 text-[var(--text-primary)]"
                aria-label="Increase columns"
              >
                +
              </button>
            </div>
          </div>

          {/* 预览 */}
          <div className="pt-2">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Preview
            </label>
            <div className="bg-[var(--editor-border)]/20 rounded p-3 overflow-x-auto">
              <TablePreview rows={rows} cols={cols} />
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--editor-border)]/50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            className="px-4 py-2 rounded text-sm font-medium bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 表格预览组件
 */
function TablePreview({ rows, cols }: { rows: number; cols: number }) {
  return (
    <table className="w-full text-xs text-[var(--text-secondary)]">
      <thead>
        <tr>
          {Array.from({ length: cols }, (_, i) => (
            <th
              key={`h-${i}`}
              className="border border-[var(--editor-border)] p-1 bg-[var(--editor-border)]/30"
            >
              Col {i + 1}
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
