import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from '../../stores/editorStore'
import { openFile, saveFile, newFile } from '../../lib/fileOps'
import { selectLocalImage, createImageMarkdown } from '../../lib/imageUtils'
import { generateTable } from '../../lib/tableUtils'
import { TableDialog } from '../TableDialog'
import type { FormatType } from '../../hooks/useTextFormat'
import { availableLanguages, type Language } from '../../i18n'

// 格式化按钮组件 - 移到外部避免每次渲染重新创建
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

// 操作按钮组件 - 用于非格式化操作（如撤销/重做）
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
    toggleDarkMode,
    toggleSidebar,
    setViewMode,
    setLanguage,
  } = useEditorStore()

  const handleSave = async () => {
    await saveFile()
  }

  const handleOpen = async () => {
    await openFile()
  }

  const handleNew = () => {
    if (isDirty) {
      if (confirm(t('dialog.confirmDiscard'))) {
        newFile()
      }
    } else {
      newFile()
    }
  }

  const handleUndo = () => {
    window.dispatchEvent(new CustomEvent('editor-undo'))
  }

  const handleRedo = () => {
    window.dispatchEvent(new CustomEvent('editor-redo'))
  }

  const handleImage = async () => {
    const imagePath = await selectLocalImage()
    if (imagePath) {
      // 提取文件名作为 alt text
      const fileName = imagePath.split(/[/\\]/).pop() || 'image'
      const altText = fileName.replace(/\.[^/.]+$/, '') // 移除扩展名
      // 传入当前文档路径，优先使用相对路径方式
      const markdown = await createImageMarkdown(altText, imagePath, filePath, {
        copyToAssets: true,
        useBase64: false,
      })
      window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: markdown } }))
    }
  }

  const handleTable = () => {
    setIsTableDialogOpen(true)
  }

  const handleInsertTable = (rows: number, cols: number) => {
    const tableMarkdown = generateTable(rows, cols)
    window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: tableMarkdown } }))
  }

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  // 检测是否为 Mac
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const cmdKey = isMac ? 'Cmd' : 'Ctrl'

  return (
    <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--editor-border)] bg-[var(--toolbar-bg)]">
      {/* 左侧 - 文件操作 */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
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

        <button
          onClick={handleNew}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
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
        </button>

        <button
          onClick={handleOpen}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
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
        </button>

        <button
          onClick={handleSave}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
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

        <div className="w-px h-6 bg-[var(--editor-border)] mx-1" />

        {/* 格式化工具 */}
        <div className="flex items-center gap-0.5">
          <FormatButton
            format="bold"
            title={t('toolbar.tooltip.bold', { shortcut: `${cmdKey}+B` })}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
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
                strokeWidth={2}
                d="M10 4h4m-2 0v16m4-16h-4m0 16h4"
                transform="skewX(-10)"
              />
            </svg>
          </FormatButton>
          <FormatButton format="strike" title={t('toolbar.tooltip.strikethrough')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 12H7m10 0a4 4 0 01-4 4H9m8-4a4 4 0 00-4-4H9"
              />
              <line x1="4" y1="12" x2="20" y2="12" strokeWidth={2} />
            </svg>
          </FormatButton>
          <FormatButton format="code" title={t('toolbar.tooltip.inlineCode')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </FormatButton>
          <FormatButton format="link" title={t('toolbar.tooltip.link')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </FormatButton>
          <ActionButton onClick={handleImage} title={t('toolbar.tooltip.insertImage')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 z"
              />
            </svg>
          </ActionButton>
          <ActionButton onClick={handleTable} title={t('toolbar.tooltip.insertTable')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {/* 表格外边框 */}
              <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.5} />
              {/* 水平分隔线 - 表头下方 */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9h18" />
              {/* 水平分隔线 - 中间 */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 14h18" />
              {/* 垂直分隔线 - 左 */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 4v16" />
              {/* 垂直分隔线 - 右 */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 4v16" />
            </svg>
          </ActionButton>
        </div>

        <div className="w-px h-6 bg-[var(--editor-border)] mx-1" />

        {/* 块级格式化 */}
        <div className="flex items-center gap-0.5">
          <FormatButton format="h1" title={t('toolbar.tooltip.heading1')}>
            <span className="text-xs font-bold">H1</span>
          </FormatButton>
          <FormatButton format="h2" title={t('toolbar.tooltip.heading2')}>
            <span className="text-xs font-bold">H2</span>
          </FormatButton>
          <FormatButton format="h3" title={t('toolbar.tooltip.heading3')}>
            <span className="text-xs font-bold">H3</span>
          </FormatButton>
          <FormatButton format="quote" title={t('toolbar.tooltip.quote')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
              />
            </svg>
          </FormatButton>
          <FormatButton format="list" title={t('toolbar.tooltip.list')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h.01" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 12h6" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 16h.01" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h6" />
            </svg>
          </FormatButton>
          <FormatButton format="codeblock" title={t('toolbar.tooltip.codeBlock')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </FormatButton>
        </div>

        <div className="w-px h-6 bg-[var(--editor-border)] mx-1" />

        <div className="flex items-center gap-1 text-sm min-w-0">
          <span className="font-medium truncate max-w-[120px]" title={fileName}>
            {fileName}
          </span>
          {isDirty && <span className="text-[var(--accent-color)] flex-shrink-0">*</span>}
        </div>
      </div>

      {/* 中间 - 视图切换 */}
      <div className="flex items-center gap-1 bg-[var(--editor-border)]/30 rounded-lg p-1">
        <button
          onClick={() => setViewMode('source')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'source'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-[var(--editor-border)]/50'
          }`}
        >
          {t('toolbar.viewMode.source')}
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'split'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-[var(--editor-border)]/50'
          }`}
        >
          {t('toolbar.viewMode.split')}
        </button>
        <button
          onClick={() => setViewMode('preview')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'preview'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-[var(--editor-border)]/50'
          }`}
        >
          {t('toolbar.viewMode.preview')}
        </button>
      </div>

      {/* 表格插入对话框 */}
      <TableDialog
        isOpen={isTableDialogOpen}
        onClose={() => setIsTableDialogOpen(false)}
        onInsert={handleInsertTable}
      />

      {/* 右侧 */}
      <div className="flex items-center gap-2">
        {/* 语言切换 */}
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as Language)}
          className="text-sm bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] cursor-pointer"
          title={t('language.title')}
        >
          {availableLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>

        <button
          onClick={toggleDarkMode}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
          title={t('toolbar.tooltip.toggleDarkMode')}
        >
          {isDarkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  )
}
