import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { getTextStats } from '../../lib/textStats'
import { isMacOS } from '../../lib/platform'
import { Dropdown, type MenuItem } from '../Menu'

const VIEW_MODES = ['wysiwyg', 'source', 'split', 'preview'] as const

/**
 * 状态栏
 *
 * 左侧：侧边栏开关、词数/字符数（200ms 防抖统计）、光标 行:列（Source/Split 模式显示）
 * 右侧：视图模式切换（点按弹出菜单，向上弹出）、缩放百分比（点击重置 100%）
 */
export function StatusBar() {
  const { t } = useTranslation()
  const {
    content,
    cursorLine,
    cursorCol,
    viewMode,
    zoomLevel,
    zoomReset,
    setViewMode,
    showSidebar,
    toggleSidebar,
  } = useEditorStore()

  // 防抖统计，避免每次按键全量重算
  const debouncedContent = useDebouncedValue(content, 200)
  const stats = useMemo(() => getTextStats(debouncedContent), [debouncedContent])

  const showCursor = viewMode === 'source' || viewMode === 'split'

  const modKey = isMacOS() ? 'Cmd' : 'Ctrl'
  const viewModeItems = useMemo<MenuItem[]>(
    () =>
      VIEW_MODES.map((mode, i) => ({
        id: mode,
        label: t(`toolbar.viewMode.${mode}`),
        checked: viewMode === mode,
        shortcut: `${modKey}+Alt+${i + 1}`,
      })),
    [t, viewMode, modKey]
  )

  return (
    <div className="h-6 flex items-center justify-between px-3 text-xs border-t border-[var(--editor-border)] bg-[var(--toolbar-bg)] text-[var(--text-secondary)] select-none">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          data-testid="statusbar-sidebar-toggle"
          className={`flex items-center p-1 -m-1 rounded transition-colors hover:bg-[var(--hover-bg)] ${
            showSidebar ? 'text-[var(--accent-color)]' : 'hover:text-[var(--text-primary)]'
          }`}
          title={t('toolbar.tooltip.toggleSidebar')}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M9 3v18" />
          </svg>
        </button>
        <span>{t('statusBar.words', { count: stats.words })}</span>
        <span>{t('statusBar.chars', { count: stats.chars })}</span>
        {showCursor && (
          <span data-testid="statusbar-cursor">
            {t('statusBar.cursor', { line: cursorLine, col: cursorCol })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Dropdown
          items={viewModeItems}
          onSelect={(id) => setViewMode(id as typeof viewMode)}
          title={t('statusBar.viewMode')}
          align="right"
          openUp
          widthClass="min-w-40"
          triggerClassName="px-1.5 py-0.5"
          trigger={
            <span data-testid="statusbar-viewmode">{t(`toolbar.viewMode.${viewMode}`)}</span>
          }
        />
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
