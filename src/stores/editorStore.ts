import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../i18n'
import { getSystemDark, resolveTheme, type ThemeMode } from '../lib/theme'

export interface RecentFile {
  path: string
  name: string
  lastOpened: number
}

export type SidebarTab = 'files' | 'outline'

// 侧栏宽度约束（setSidebarWidth clamp 与 useResizable 共用）
export const SIDEBAR_MIN_WIDTH = 180
export const SIDEBAR_MAX_WIDTH = 400
export const SIDEBAR_DEFAULT_WIDTH = 224

export interface EditorState {
  // 文档状态
  content: string
  filePath: string | null
  fileName: string
  isDirty: boolean

  // 最近文件
  recentFiles: RecentFile[]

  // UI 状态
  // isDarkMode 是派生值（由 themeMode + 系统偏好解析），不持久化
  isDarkMode: boolean
  themeMode: ThemeMode
  showSidebar: boolean
  sidebarTab: SidebarTab
  sidebarWidth: number
  viewMode: 'wysiwyg' | 'source' | 'preview' | 'split'
  activeBlockId: string | null
  language: Language
  zoomLevel: number

  // 历史记录状态
  canUndo: boolean
  canRedo: boolean

  // 光标位置（1-based，供状态栏显示，不持久化）
  cursorLine: number
  cursorCol: number

  // WYSIWYG 下光标所处的大纲标题序号（对应 OutlineItem.index，不持久化；
  // source/split 由 cursorLine 推导，无需此字段）
  activeHeadingIndex: number | null

  // 文件树状态
  openedFolder: string | null

  // 设置面板（不持久化）
  isSettingsOpen: boolean

  // Actions
  setContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setFileName: (name: string) => void
  setDirty: (dirty: boolean) => void
  addRecentFile: (path: string, name: string) => void
  renameRecentFile: (oldPath: string, newPath: string, newName: string) => void
  clearRecentFiles: () => void
  removeRecentFile: (path: string) => void
  toggleDarkMode: () => void
  setThemeMode: (mode: ThemeMode) => void
  setSystemDark: (systemDark: boolean) => void
  toggleSidebar: () => void
  setSidebarTab: (tab: SidebarTab) => void
  setSidebarWidth: (width: number) => void
  setViewMode: (mode: 'wysiwyg' | 'source' | 'preview' | 'split') => void
  setActiveBlockId: (id: string | null) => void
  setCanUndo: (canUndo: boolean) => void
  setCanRedo: (canRedo: boolean) => void
  setCursorPosition: (line: number, col: number) => void
  setActiveHeadingIndex: (index: number | null) => void
  setLanguage: (lang: Language) => void
  setOpenedFolder: (path: string | null) => void
  setSettingsOpen: (open: boolean) => void
  resetDocument: (content?: string) => void
  setZoomLevel: (level: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
}

// 获取默认内容（根据语言）
export function getDefaultContent(
  t: (key: string, options?: Record<string, string>) => string
): string {
  return `# ${t('welcome.title')}

${t('welcome.subtitle')}

## ${t('welcome.features')}

- ${t('welcome.featureList.blockEditing')}
- ${t('welcome.featureList.syntaxHighlight')}
- ${t('welcome.featureList.fileOperations')}
- ${t('welcome.featureList.autoSave')}
- ${t('welcome.featureList.dragDrop')}
- ${t('welcome.featureList.darkMode')}

## ${t('welcome.gettingStarted')}

${t('welcome.gettingStartedList.openFile', { shortcut: 'Cmd+O' })}
${t('welcome.gettingStartedList.newFile', { shortcut: 'Cmd+N' })}
${t('welcome.gettingStartedList.saveFile', { shortcut: 'Cmd+S' })}
${t('welcome.gettingStartedList.switchMode')}

> "${t('welcome.quote')}"

\`\`\`javascript
console.log('Hello, VividMark!');
\`\`\`
`
}

// 初始默认内容（英语）
const INITIAL_DEFAULT_CONTENT = `# Welcome to VividMark

A **modern** Markdown editor built with Tauri and React.

## Features

- Block-level editing with live preview
- Syntax highlighting for code blocks
- Native file operations (Open/Save)
- Auto-save after 2 seconds of inactivity
- Drag & drop file opening
- Dark mode support

## Getting Started

- Open an existing file with Cmd+O
- Create a new file with Cmd+N
- Save with Cmd+S
- Switch between Source/Split/Preview modes

> "The best writing tool is the one that gets out of your way."

\`\`\`javascript
console.log('Hello, VividMark!');
\`\`\`
`

const MAX_RECENT_FILES = 10

/** persist 持久化的字段子集 */
export interface PersistedEditorState {
  recentFiles: RecentFile[]
  themeMode: ThemeMode
  language: Language
  viewMode: EditorState['viewMode']
  zoomLevel: number
  showSidebar: boolean
  sidebarTab: SidebarTab
  sidebarWidth: number
}

/** v0 → v1 迁移：旧 persisted 的 isDarkMode: boolean 转为 themeMode，并移除 isDarkMode */
export function migratePersistedState(
  persistedState: unknown,
  version: number
): PersistedEditorState {
  if (version === 0) {
    const { isDarkMode: legacyIsDarkMode, ...rest } =
      persistedState as Partial<PersistedEditorState> & {
        isDarkMode?: boolean
      }
    return { ...rest, themeMode: legacyIsDarkMode ? 'dark' : 'light' } as PersistedEditorState
  }
  return persistedState as PersistedEditorState
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      content: INITIAL_DEFAULT_CONTENT,
      filePath: null,
      fileName: 'Untitled.md',
      language: 'en',
      isDirty: false,
      recentFiles: [],
      themeMode: 'system',
      isDarkMode: resolveTheme('system', getSystemDark()),
      showSidebar: true,
      sidebarTab: 'outline',
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      viewMode: 'wysiwyg',
      activeBlockId: null,
      canUndo: false,
      canRedo: false,
      cursorLine: 1,
      cursorCol: 1,
      activeHeadingIndex: null,
      openedFolder: null,
      zoomLevel: 100,
      isSettingsOpen: false,

      setContent: (content) => set({ content, isDirty: true }),
      setFilePath: (path) => set({ filePath: path }),
      setFileName: (name) => set({ fileName: name }),
      setDirty: (dirty) => set({ isDirty: dirty }),

      addRecentFile: (path, name) =>
        set((state) => {
          // 移除已存在的相同路径
          const filtered = state.recentFiles.filter((f) => f.path !== path)
          // 添加到开头
          const newFile: RecentFile = {
            path,
            name,
            lastOpened: Date.now(),
          }
          // 限制最大数量
          const recentFiles = [newFile, ...filtered].slice(0, MAX_RECENT_FILES)
          return { recentFiles }
        }),

      clearRecentFiles: () => set({ recentFiles: [] }),

      // 最近文件右键菜单「从列表移除」（不删文件本身）
      removeRecentFile: (path) =>
        set((state) => ({
          recentFiles: state.recentFiles.filter((f) => f.path !== path),
        })),

      // 文件树重命名当前文件时同步最近文件条目
      renameRecentFile: (oldPath, newPath, newName) =>
        set((state) => ({
          recentFiles: state.recentFiles.map((f) =>
            f.path === oldPath ? { ...f, path: newPath, name: newName } : f
          ),
        })),

      toggleDarkMode: () =>
        set((state) => {
          // 显式在 light/dark 间切换（脱离 system 跟随）
          const themeMode: ThemeMode = state.isDarkMode ? 'light' : 'dark'
          return { themeMode, isDarkMode: resolveTheme(themeMode, getSystemDark()) }
        }),
      setThemeMode: (mode) =>
        set({ themeMode: mode, isDarkMode: resolveTheme(mode, getSystemDark()) }),
      setSystemDark: (systemDark) => {
        // 仅 system 模式下系统偏好才影响实际主题
        if (get().themeMode !== 'system') return
        set({ isDarkMode: systemDark })
      },
      toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      setSidebarWidth: (width) =>
        set({
          sidebarWidth: Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width)),
        }),
      setViewMode: (mode: 'wysiwyg' | 'source' | 'preview' | 'split') => set({ viewMode: mode }),
      setActiveBlockId: (id) => set({ activeBlockId: id }),
      setCanUndo: (canUndo) => set({ canUndo }),
      setCanRedo: (canRedo) => set({ canRedo }),
      setCursorPosition: (line, col) => set({ cursorLine: line, cursorCol: col }),
      // 相等守卫：光标在同一标题区间内移动时避免冗余 set（触发全量订阅者重渲染）
      setActiveHeadingIndex: (index) => {
        if (get().activeHeadingIndex === index) return
        set({ activeHeadingIndex: index })
      },
      setLanguage: (lang: Language) => set({ language: lang }),
      setOpenedFolder: (path) => set({ openedFolder: path }),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      resetDocument: (content?: string) =>
        set({
          content: content ?? '',
          filePath: null,
          fileName: 'Untitled.md',
          isDirty: false,
          activeBlockId: null,
          canUndo: false,
          canRedo: false,
          cursorLine: 1,
          cursorCol: 1,
          activeHeadingIndex: null,
        }),
      setZoomLevel: (level) => set({ zoomLevel: Math.max(50, Math.min(200, level)) }),
      zoomIn: () => set((state) => ({ zoomLevel: Math.min(200, state.zoomLevel + 10) })),
      zoomOut: () => set((state) => ({ zoomLevel: Math.max(50, state.zoomLevel - 10) })),
      zoomReset: () => set({ zoomLevel: 100 }),
    }),
    {
      name: 'vividmark-storage',
      version: 1,
      migrate: migratePersistedState,
      // 合并时按持久化的 themeMode 重新推导 isDarkMode（系统偏好可能已变化）
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedEditorState> | undefined
        const themeMode = persisted?.themeMode ?? currentState.themeMode
        return {
          ...currentState,
          ...persisted,
          themeMode,
          isDarkMode: resolveTheme(themeMode, getSystemDark()),
        }
      },
      // 只持久化部分状态
      partialize: (state): PersistedEditorState => ({
        recentFiles: state.recentFiles,
        themeMode: state.themeMode,
        language: state.language,
        viewMode: state.viewMode,
        zoomLevel: state.zoomLevel,
        showSidebar: state.showSidebar,
        sidebarTab: state.sidebarTab,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
)
