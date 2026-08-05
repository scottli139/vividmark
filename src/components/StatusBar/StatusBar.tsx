import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { getTextStats } from '../../lib/textStats'

/**
 * 状态栏
 *
 * 左侧：词数/字符数（200ms 防抖统计）、光标 行:列（Source/Split 模式显示）
 * 右侧：视图模式、缩放百分比（点击重置 100%）
 */
export function StatusBar() {
  const { t } = useTranslation()
  const { content, cursorLine, cursorCol, viewMode, zoomLevel, zoomReset } = useEditorStore()

  // 防抖统计，避免每次按键全量重算
  const debouncedContent = useDebouncedValue(content, 200)
  const stats = useMemo(() => getTextStats(debouncedContent), [debouncedContent])

  const showCursor = viewMode === 'source' || viewMode === 'split'

  return (
    <div className="h-6 flex items-center justify-between px-3 text-xs border-t border-[var(--editor-border)] bg-[var(--toolbar-bg)] text-[var(--text-secondary)] select-none">
      <div className="flex items-center gap-4">
        <span>{t('statusBar.words', { count: stats.words })}</span>
        <span>{t('statusBar.chars', { count: stats.chars })}</span>
        {showCursor && (
          <span data-testid="statusbar-cursor">
            {t('statusBar.cursor', { line: cursorLine, col: cursorCol })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span>{t(`toolbar.viewMode.${viewMode}`)}</span>
        <button
          onClick={zoomReset}
          className="hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title={t('statusBar.zoomReset')}
        >
          {zoomLevel}%
        </button>
      </div>
    </div>
  )
}
