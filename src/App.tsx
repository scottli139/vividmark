import { useEffect, useRef } from 'react'
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
import { initOpenWith } from './lib/openWith'
import { initWindowManager } from './lib/windowManager'
import { Dialog } from './components/Dialog'
import { ImageLightbox } from './components/ImageLightbox'
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

  // 系统原生菜单 / 文件关联 / 多窗口管理（仅 Tauri 桌面端；浏览器 dev 为 no-op）
  //
  // 三个 init 都注册事件监听且返回异步 cleanup；React StrictMode 双挂载会让
  // 「cleanup 在 promise resolve 前执行」竞态导致首批 listener 泄漏（每个事件
  // 处理两次——多窗口下 open-recent 双调用会竞态建出重复窗口）。useRef 防重
  // 保证每次挂载周期只初始化一次；listener 生命周期跟随 webview 上下文，
  // 窗口销毁即释放，无需手动 cleanup。
  const tauriInitedRef = useRef(false)
  useEffect(() => {
    if (tauriInitedRef.current) return
    tauriInitedRef.current = true
    void initNativeMenu()
    void initOpenWith()
    void initWindowManager()
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
      <ImageLightbox />
    </div>
  )
}

export default App
