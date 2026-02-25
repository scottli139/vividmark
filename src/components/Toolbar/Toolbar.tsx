import { useEditorStore } from '../../stores/editorStore'
import { openFile, saveFile, saveFileAs, newFile } from '../../lib/fileOps'

export function Toolbar() {
  const {
    fileName,
    isDirty,
    isDarkMode,
    showSidebar,
    viewMode,
    toggleDarkMode,
    toggleSidebar,
    setViewMode
  } = useEditorStore()

  const handleSave = async () => {
    await saveFile()
  }

  const handleSaveAs = async () => {
    await saveFileAs()
  }

  const handleOpen = async () => {
    await openFile()
  }

  const handleNew = () => {
    if (isDirty) {
      // TODO: 添加确认对话框
      if (confirm('Discard unsaved changes?')) {
        newFile()
      }
    } else {
      newFile()
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="w-px h-6 bg-[var(--editor-border)] mx-1" />

        <button
          onClick={handleNew}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
          title="New File (Cmd+N)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        <button
          onClick={handleOpen}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
          title="Open File (Cmd+O)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
          </svg>
        </button>

        <button
          onClick={handleSave}
          className="p-2 rounded hover:bg-[var(--editor-border)]/50 transition-colors"
          title="Save (Cmd+S)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        </button>

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
