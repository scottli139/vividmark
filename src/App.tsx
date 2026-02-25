import { useEditorStore } from './stores/editorStore'
import { Editor } from './components/Editor/Editor'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useFileDragDrop } from './hooks/useFileDragDrop'
import { useAutoSave } from './hooks/useAutoSave'
import './styles/globals.css'

function App() {
  const { isDarkMode } = useEditorStore()

  // 注册全局快捷键
  useKeyboardShortcuts()

  // 文件拖放支持
  const { isDragging } = useFileDragDrop()

  // 自动保存
  useAutoSave()

  return (
    <div
      className={`h-screen flex flex-col ${isDarkMode ? 'dark bg-[#1a1a1a] text-[#e5e5e5]' : 'bg-white text-[#1a1a1a]'}`}
    >
      <Toolbar />
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 flex overflow-hidden">
          <Editor />
        </main>

        {/* 拖放覆盖层 */}
        {isDragging && (
          <div className="absolute inset-0 bg-[var(--accent-color)]/10 border-2 border-dashed border-[var(--accent-color)] flex items-center justify-center z-50">
            <div
              className={`text-center p-8 rounded-lg ${isDarkMode ? 'bg-[#2a2a2a]' : 'bg-white'} shadow-lg`}
            >
              <svg
                className="w-16 h-16 mx-auto mb-4 text-[var(--accent-color)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-lg font-medium">Drop Markdown file here</p>
              <p className="text-sm opacity-60 mt-1">.md, .markdown, .txt</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
