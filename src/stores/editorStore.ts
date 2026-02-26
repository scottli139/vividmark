import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../i18n'

export interface RecentFile {
  path: string
  name: string
  lastOpened: number
}

export interface EditorState {
  // 文档状态
  content: string
  filePath: string | null
  fileName: string
  isDirty: boolean

  // 最近文件
  recentFiles: RecentFile[]

  // UI 状态
  isDarkMode: boolean
  showSidebar: boolean
  viewMode: 'source' | 'preview' | 'split'
  activeBlockId: string | null
  language: Language

  // 历史记录状态
  canUndo: boolean
  canRedo: boolean

  // Actions
  setContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setFileName: (name: string) => void
  setDirty: (dirty: boolean) => void
  addRecentFile: (path: string, name: string) => void
  clearRecentFiles: () => void
  toggleDarkMode: () => void
  toggleSidebar: () => void
  setViewMode: (mode: 'source' | 'preview' | 'split') => void
  setActiveBlockId: (id: string | null) => void
  setCanUndo: (canUndo: boolean) => void
  setCanRedo: (canRedo: boolean) => void
  setLanguage: (lang: Language) => void
  resetDocument: (content?: string) => void
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

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      content: INITIAL_DEFAULT_CONTENT,
      filePath: null,
      fileName: 'Untitled.md',
      language: 'en',
      isDirty: false,
      recentFiles: [],
      isDarkMode: false,
      showSidebar: true,
      viewMode: 'source',
      activeBlockId: null,
      canUndo: false,
      canRedo: false,

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

      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
      setViewMode: (mode: 'source' | 'preview' | 'split') => set({ viewMode: mode }),
      setActiveBlockId: (id) => set({ activeBlockId: id }),
      setCanUndo: (canUndo) => set({ canUndo }),
      setCanRedo: (canRedo) => set({ canRedo }),
      setLanguage: (lang: Language) => set({ language: lang }),
      resetDocument: (content?: string) =>
        set({
          content: content ?? '',
          filePath: null,
          fileName: 'Untitled.md',
          isDirty: false,
          activeBlockId: null,
          canUndo: false,
          canRedo: false,
        }),
    }),
    {
      name: 'vividmark-storage',
      // 只持久化部分状态
      partialize: (state) => ({
        recentFiles: state.recentFiles,
        isDarkMode: state.isDarkMode,
        language: state.language,
      }),
    }
  )
)
