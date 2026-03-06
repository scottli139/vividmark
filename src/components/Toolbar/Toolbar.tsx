import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { openFile, saveFile, newFile } from '../../lib/fileOps'
import { selectLocalImage, createImageMarkdown } from '../../lib/imageUtils'
import { generateTable } from '../../lib/tableUtils'
import { TableDialog } from '../TableDialog'
import { FormatMenu } from './FormatMenu'
import { HeadingDropdown } from './HeadingDropdown'
import { InsertMenu } from './InsertMenu'
import type { FormatType } from '../../hooks/useTextFormat'
import { availableLanguages, type Language } from '../../i18n'
import { getCurrentWindow } from '@tauri-apps/api/window'

// 格式化按钮组件
function FormatButton({
  format,
  title,
  children,
}: {
  format: FormatType
  title: string
  children: React.ReactNode
}) {
  const handleFormatClick = () => {
    window.dispatchEvent(new CustomEvent('editor-format', { detail: { format } }))
  }

  return (
    <button
      onClick={handleFormatClick}
      className="p-1.5 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
      title={title}
    >
      {children}
    </button>
  )
}

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
          ? 'bg-white dark:bg-gray-700 shadow-sm text-[var(--color-text)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--editor-border)]/50 hover:text-[var(--color-text)]'
      }`}
      title={label}
    >
      {label}
    </button>
  )
}

export function Toolbar() {
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const { t, i18n } = useTranslation()

  const {
    fileName,
    filePath,
    isDirty,
    isDarkMode,
    viewMode,
    canUndo,
    canRedo,
    language,
    zoomLevel,
    showSidebar,
    toggleDarkMode,
    toggleSidebar,
    setViewMode,
    setLanguage,
    zoomIn,
    zoomOut,
    zoomReset,
  } = useEditorStore()

  // 更新窗口标题
  useEffect(() => {
    const updateTitle = async () => {
      try {
        const window = getCurrentWindow()
        const dirtyMark = isDirty ? ' ●' : ''
        const baseTitle = fileName !== t('app.untitled') ? fileName : '未命名'
        await window.setTitle(`${baseTitle}${dirtyMark} - VividMark`)
      } catch {
        // 在浏览器环境中会失败，忽略错误
      }
    }
    updateTitle()
  }, [fileName, isDirty, t])

  const handleSave = useCallback(async () => {
    await saveFile()
  }, [])

  const handleOpen = useCallback(async () => {
    await openFile()
  }, [])

  const handleNew = useCallback(() => {
    if (isDirty) {
      if (confirm(t('dialog.confirmDiscard'))) {
        newFile()
      }
    } else {
      newFile()
    }
  }, [isDirty, t])

  const handleUndo = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor-undo'))
  }, [])

  const handleRedo = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor-redo'))
  }, [])

  const handleImage = useCallback(async () => {
    const imagePath = await selectLocalImage()
    if (imagePath) {
      const fileName = imagePath.split(/[/\\]/).pop() || 'image'
      const altText = fileName.replace(/\.[^/.]+$/, '')
      const markdown = await createImageMarkdown(altText, imagePath, filePath, {
        copyToAssets: true,
        useBase64: false,
      })
      window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: markdown } }))
    }
  }, [filePath])

  const handleTable = useCallback(() => {
    setIsTableDialogOpen(true)
  }, [])

  const handleInsertTable = useCallback((rows: number, cols: number) => {
    const tableMarkdown = generateTable(rows, cols)
    window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: tableMarkdown } }))
  }, [])

  const handleFormat = useCallback((format: FormatType) => {
    window.dispatchEvent(new CustomEvent('editor-format', { detail: { format } }))
  }, [])

  const handleHeadingSelect = useCallback((level: 1 | 2 | 3) => {
    const format: FormatType = `h${level}` as FormatType
    window.dispatchEvent(new CustomEvent('editor-format', { detail: { format } }))
  }, [])

  const handleCodeBlock = useCallback(() => {
    window.dispatchEvent(new CustomEvent('editor-format', { detail: { format: 'codeblock' } }))
  }, [])

  const handleLanguageChange = useCallback(
    (lang: Language) => {
      setLanguage(lang)
      i18n.changeLanguage(lang)
    },
    [setLanguage, i18n]
  )

  // 检测是否为 Mac
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  return (
    <div className="h-12 flex items-center justify-between px-3 border-b border-[var(--editor-border)] bg-[var(--toolbar-bg)]">
      {/* 左侧 - 文件操作和基础工具 */}
      <div className="flex items-center gap-1">
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

        {/* 文件操作 */}
        <ActionButton
          onClick={handleNew}
          title={t('toolbar.tooltip.newFile', { shortcut: `${cmdKey}+N` })}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </ActionButton>
        <ActionButton
          onClick={handleOpen}
          title={t('toolbar.tooltip.openFile', { shortcut: `${cmdKey}+O` })}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z"
            />
          </svg>
        </ActionButton>
        <ActionButton
          onClick={handleSave}
          title={t('toolbar.tooltip.save', { shortcut: `${cmdKey}+S` })}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            />
          </svg>
        </ActionButton>

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

      {/* 中间 - 格式化工具 */}
      <div className="flex items-center gap-0.5">
        {/* 基础格式化 */}
        <div className="flex items-center gap-0.5 bg-[var(--editor-border)]/20 rounded-lg p-0.5">
          <FormatButton
            format="bold"
            title={t('toolbar.tooltip.bold', { shortcut: `${cmdKey}+B` })}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
              />
            </svg>
          </FormatButton>
          <FormatButton
            format="italic"
            title={t('toolbar.tooltip.italic', { shortcut: `${cmdKey}+I` })}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 4h-2l-4 16h2"
              />
            </svg>
          </FormatButton>

          <div className="w-px h-4 bg-[var(--editor-border)] mx-0.5" />

          {/* 标题下拉 */}
          <HeadingDropdown onSelect={handleHeadingSelect} />

          {/* 列表 */}
          <FormatButton format="list" title={t('toolbar.tooltip.list')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 6h.01M8 12h.01M8 18h.01"
              />
            </svg>
          </FormatButton>
        </div>

        <div className="w-px h-6 bg-[var(--editor-border)] mx-2" />

        {/* 插入菜单 */}
        <InsertMenu onImage={handleImage} onTable={handleTable} onCodeBlock={handleCodeBlock} />

        {/* 更多格式化 */}
        <FormatMenu onFormat={handleFormat} />

        <div className="w-px h-6 bg-[var(--editor-border)] mx-2" />

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
      </div>

      {/* 右侧 - 缩放和设置 */}
      <div className="flex items-center gap-2">
        {/* 缩放控制 */}
        <div className="flex items-center gap-0.5 bg-[var(--editor-border)]/20 rounded-lg px-1">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
            title={t('toolbar.tooltip.zoomOut', { shortcut: `${cmdKey}+-` })}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={zoomReset}
            className="px-1.5 py-1 text-xs font-medium min-w-[36px] text-center hover:bg-[var(--editor-border)]/50 rounded transition-colors"
            title={t('toolbar.tooltip.zoomReset', { shortcut: `${cmdKey}+0` })}
          >
            {zoomLevel}%
          </button>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
            title={t('toolbar.tooltip.zoomIn', { shortcut: `${cmdKey}+=` })}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        <div className="w-px h-6 bg-[var(--editor-border)] mx-1" />

        {/* 语言切换 */}
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as Language)}
          className="text-xs bg-transparent border border-[var(--editor-border)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)] cursor-pointer"
          title={t('language.title')}
        >
          {availableLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>

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
      </div>

      {/* 表格插入对话框 */}
      <TableDialog
        isOpen={isTableDialogOpen}
        onClose={() => setIsTableDialogOpen(false)}
        onInsert={handleInsertTable}
      />
    </div>
  )
}
