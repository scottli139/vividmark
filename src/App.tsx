import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorStore } from './stores/editorStore'
import { Editor } from './components/Editor/Editor'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Sidebar } from './components/Sidebar/Sidebar'
import { StatusBar } from './components/StatusBar/StatusBar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useFileDragDrop } from './hooks/useFileDragDrop'
import { useAutoSave } from './hooks/useAutoSave'
import { initNativeMenu } from './lib/nativeMenu'
import { Dialog } from './components/Dialog'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { isMacOSDesktop } from './lib/platform'
import './styles/globals.css'

function App() {
  const { t, i18n } = useTranslation()
  const { isDarkMode, language, setSystemDark } = useEditorStore()

  // 同步语言设置
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])

  // 把主题应用到根元素：Tailwind dark: 变体与 CSS 变量都以 .dark 为准
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  // 监听系统主题变化（store 内仅 themeMode 为 system 时生效）
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [setSystemDark])

  // macOS 融合标题栏：为根元素打标，工具栏据此预留 traffic light 区域
  useEffect(() => {
    if (isMacOSDesktop()) {
      document.documentElement.classList.add('is-macos')
      return () => document.documentElement.classList.remove('is-macos')
    }
  }, [])

  // 注册全局快捷键
  useKeyboardShortcuts()

  // 系统原生菜单（仅 Tauri 桌面端；浏览器 dev 环境为 no-op）
  useEffect(() => {
    let cleanup: (() => void) | undefined
    void initNativeMenu().then((fn) => {
      cleanup = fn
    })
    return () => cleanup?.()
  }, [])

  // 文件拖放支持
  const { isDragging } = useFileDragDrop()

  // 自动保存
  useAutoSave()

  return (
    <div className="h-screen flex flex-col bg-[var(--editor-bg)] text-[var(--editor-text)]">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar />
        <main className="flex-1 flex overflow-hidden">
          <Editor />
        </main>

        {/* 拖放覆盖层 */}
        {isDragging && (
          <div className="absolute inset-0 bg-[var(--accent-color)]/10 border-2 border-dashed border-[var(--accent-color)] flex items-center justify-center z-50">
            <div className="text-center p-8 rounded-lg bg-[var(--editor-bg)] shadow-lg">
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
              <p className="text-lg font-medium">{t('app.dropTitle')}</p>
              <p className="text-sm opacity-60 mt-1">{t('app.dropFileTypes')}</p>
            </div>
          </div>
        )}
      </div>
      <StatusBar />
      <Dialog />
      <SettingsDialog />
    </div>
  )
}

export default App
