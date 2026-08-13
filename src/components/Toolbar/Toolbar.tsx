import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { generateTable } from '../../lib/tableUtils'
import { TableDialog } from '../TableDialog'
import { AdmonitionDialog } from '../AdmonitionDialog'
import { MoreMenu } from './MoreMenu'
import { isMacOSDesktop } from '../../lib/platform'
import { getCurrentWindow } from '@tauri-apps/api/window'

// 操作按钮组件
function ActionButton({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded hover:bg-[var(--editor-border)]/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title={title}
    >
      {children}
    </button>
  )
}

// 视图切换按钮
function ViewModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-[var(--active-bg)] shadow-sm text-[var(--color-text)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--editor-border)]/50 hover:text-[var(--color-text)]'
      }`}
      title={label}
    >
      {label}
    </button>
  )
}

/**
 * 工具栏（精简后）：只保留高频操作——侧边栏切换、撤销/重做、视图模式切换、
 * 暗色切换、更多菜单。文件操作与格式化/插入全部由原生菜单（文件/编辑/段落/
 * 格式）+ 编辑器右键菜单 + 快捷键覆盖。表格/提示框对话框仍挂载在此，
 * 由 app-open-dialog 事件触发（原生菜单 insert:table / insert:admonition）。
 */
export function Toolbar() {
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [isAdmonitionDialogOpen, setIsAdmonitionDialogOpen] = useState(false)
  const { t } = useTranslation()

  const {
    fileName,
    isDirty,
    isDarkMode,
    viewMode,
    canUndo,
    canRedo,
    showSidebar,
    toggleDarkMode,
    toggleSidebar,
    setViewMode,
  } = useEditorStore()

  // 更新窗口标题（Typora 式：文件名 + 脏标记；Dock 窗口列表/Mission Control 依此区分文档）
  useEffect(() => {
    const updateTitle = async () => {
      try {
        const window = getCurrentWindow()
        const dirtyMark = isDirty ? ' ●' : ''
        const baseTitle = fileName === 'Untitled.md' ? t('app.untitled') : fileName
        await window.setTitle(`${baseTitle}${dirtyMark}`)
      } catch {
        // 在浏览器环境中会失败，忽略错误
      }
    }
    updateTitle()
  }, [fileName, isDirty, t])

  // 原生菜单/其他入口经事件打开插入对话框
  useEffect(() => {
    const handleOpenDialog = (e: Event) => {
      const { dialog } = (e as CustomEvent<{ dialog: string }>).detail
      if (dialog === 'table') setIsTableDialogOpen(true)
      else if (dialog === 'admonition') setIsAdmonitionDialogOpen(true)
    }
    window.addEventListener('app-open-dialog', handleOpenDialog)
    return () => window.removeEventListener('app-open-dialog', handleOpenDialog)
  }, [])

  const handleUndo = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor-undo'))
  }, [])

  const handleRedo = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor-redo'))
  }, [])

  const handleInsertTable = useCallback((rows: number, cols: number) => {
    const tableMarkdown = generateTable(rows, cols)
    window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: tableMarkdown } }))
  }, [])

  const handleInsertAdmonition = useCallback((type: string, title: string) => {
    const text = `::: ${type}${title ? ` ${title}` : ''}\n\n:::\n`
    window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text } }))
  }, [])

  // 检测是否为 Mac
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  // macOS 融合标题栏：预留 traffic light 区域 + 自绘文件名（hiddenTitle 后系统标题不可见）
  const macFusion = isMacOSDesktop()
  const displayTitle = fileName === 'Untitled.md' ? t('app.untitled') : fileName

  return (
    <div
      data-tauri-drag-region
      className={`h-12 flex items-center justify-between px-3 border-b border-[var(--editor-border)] bg-[var(--toolbar-bg)] ${
        macFusion ? 'pl-[78px]' : ''
      }`}
    >
      {/* 左侧 - 侧边栏切换与撤销/重做 */}
      <div data-tauri-drag-region className="flex items-center gap-1">
        {/* 侧边栏切换 */}
        <button
          onClick={toggleSidebar}
          className={`p-2 rounded transition-colors ${
            showSidebar
              ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
              : 'hover:bg-[var(--editor-border)]/50'
          }`}
          title={t('toolbar.tooltip.toggleSidebar')}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <div className="w-px h-6 bg-[var(--editor-border)] mx-1" />

        {/* 撤销/重做 */}
        <ActionButton
          onClick={handleUndo}
          title={t('toolbar.tooltip.undo', { shortcut: `${cmdKey}+Z` })}
          disabled={!canUndo}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </ActionButton>
        <ActionButton
          onClick={handleRedo}
          title={t('toolbar.tooltip.redo', { shortcut: `${cmdKey}+Shift+Z` })}
          disabled={!canRedo}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
            />
          </svg>
        </ActionButton>
      </div>

      {/* macOS 融合标题栏：自绘文件名（弹性占位 + 截断防重叠，窄窗口隐藏） */}
      {macFusion && (
        <div className="flex-1 min-w-0 truncate text-center text-xs font-medium text-[var(--color-text-secondary)] pointer-events-none select-none hidden min-[760px]:block">
          {displayTitle}
          {isDirty ? ' ●' : ''}
        </div>
      )}

      {/* 右侧 - 视图切换、暗色切换和更多菜单 */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        {/* 视图切换 */}
        <div className="flex items-center gap-0.5 bg-[var(--editor-border)]/30 rounded-lg p-0.5">
          <ViewModeButton
            active={viewMode === 'wysiwyg'}
            label={t('toolbar.viewMode.wysiwyg')}
            onClick={() => setViewMode('wysiwyg')}
          />
          <ViewModeButton
            active={viewMode === 'source'}
            label={t('toolbar.viewMode.source')}
            onClick={() => setViewMode('source')}
          />
          <ViewModeButton
            active={viewMode === 'split'}
            label={t('toolbar.viewMode.split')}
            onClick={() => setViewMode('split')}
          />
          <ViewModeButton
            active={viewMode === 'preview'}
            label={t('toolbar.viewMode.preview')}
            onClick={() => setViewMode('preview')}
          />
        </div>

        {/* 暗黑模式切换 */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
          title={t('toolbar.tooltip.toggleDarkMode')}
        >
          {isDarkMode ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>
        {/* 更多菜单（缩放 / 导出 PDF / 语言 / 设置） */}
        <MoreMenu />
      </div>

      {/* 表格插入对话框 */}
      <TableDialog
        isOpen={isTableDialogOpen}
        onClose={() => setIsTableDialogOpen(false)}
        onInsert={handleInsertTable}
      />

      {/* Admonition 插入对话框 */}
      <AdmonitionDialog
        isOpen={isAdmonitionDialogOpen}
        onClose={() => setIsAdmonitionDialogOpen(false)}
        onInsert={handleInsertAdmonition}
      />
    </div>
  )
}
