import { useEditorStore } from '../../stores/editorStore'
import { openFile, saveFile, newFile } from '../../lib/fileOps'
import { selectLocalImage, createImageMarkdown } from '../../lib/imageUtils'
import type { FormatType } from '../../hooks/useTextFormat'

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
  const {
    fileName,
    isDirty,
    isDarkMode,
    viewMode,
    canUndo,
    canRedo,
    toggleDarkMode,
    toggleSidebar,
    setViewMode,
  } = useEditorStore()

  const handleSave = async () => {
    await saveFile()
  }

  const handleOpen = async () => {
    await openFile()
  }

  const handleNew = () => {
    if (isDirty) {
      if (confirm('Discard unsaved changes?')) {
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
      // 使用异步函数将本地图片转换为 base64
      const markdown = await createImageMarkdown(altText, imagePath)
      window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: markdown } }))
    }
  }

  return (
    <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--editor-border)] bg-[var(--toolbar-bg)]">
      {/* 左侧 - 文件操作 */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
          title="Toggle Sidebar"
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
          title="New File (Cmd+N)"
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
          title="Open File (Cmd+O)"
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
          title="Save (Cmd+S)"
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
        <ActionButton onClick={handleUndo} title="Undo (Cmd+Z)" disabled={!canUndo}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </ActionButton>
        <ActionButton onClick={handleRedo} title="Redo (Cmd+Shift+Z)" disabled={!canRedo}>
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
          <FormatButton format="bold" title="Bold (Cmd+B)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
              />
            </svg>
          </FormatButton>
          <FormatButton format="italic" title="Italic (Cmd+I)">
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
          <FormatButton format="strike" title="Strikethrough">
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
          <FormatButton format="code" title="Inline Code">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </FormatButton>
          <FormatButton format="link" title="Link">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </FormatButton>
          <ActionButton onClick={handleImage} title="Insert Image">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </ActionButton>
        </div>

        <div className="w-px h-6 bg-[var(--editor-border)] mx-1" />

        {/* 块级格式化 */}
        <div className="flex items-center gap-0.5">
          <FormatButton format="h1" title="Heading 1">
            <span className="text-xs font-bold">H1</span>
          </FormatButton>
          <FormatButton format="h2" title="Heading 2">
            <span className="text-xs font-bold">H2</span>
          </FormatButton>
          <FormatButton format="h3" title="Heading 3">
            <span className="text-xs font-bold">H3</span>
          </FormatButton>
          <FormatButton format="quote" title="Quote">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
            </svg>
          </FormatButton>
          <FormatButton format="list" title="List">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </FormatButton>
          <FormatButton format="codeblock" title="Code Block">
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

        <div className="flex items-center gap-1 text-sm">
          <span className="font-medium">{fileName}</span>
          {isDirty && <span className="text-[var(--accent-color)]">*</span>}
        </div>
      </div>

      {/* 中间 - 视图切换 */}
      <div className="flex items-center gap-1 bg-[var(--editor-border)]/30 rounded-lg p-1">
        <button
          onClick={() => setViewMode('edit')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'edit'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-[var(--editor-border)]/50'
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'split'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-[var(--editor-border)]/50'
          }`}
        >
          Split
        </button>
        <button
          onClick={() => setViewMode('preview')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'preview'
              ? 'bg-white dark:bg-gray-700 shadow-sm'
              : 'hover:bg-[var(--editor-border)]/50'
          }`}
        >
          Preview
        </button>
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
          title="Toggle Dark Mode"
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
