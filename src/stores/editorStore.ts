import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  viewMode: 'edit' | 'preview' | 'split'
  activeBlockId: string | null

  // Actions
  setContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setFileName: (name: string) => void
  setDirty: (dirty: boolean) => void
  addRecentFile: (path: string, name: string) => void
  clearRecentFiles: () => void
  toggleDarkMode: () => void
  toggleSidebar: () => void
  setViewMode: (mode: 'edit' | 'preview' | 'split') => void
  setActiveBlockId: (id: string | null) => void
  resetDocument: () => void
}

const DEFAULT_CONTENT = `# Welcome to VividMark

A **modern** Markdown editor built with Tauri and React.

## Features

- Real-time Markdown preview
- Clean, distraction-free interface
- Dark mode support
- Cross-platform

## Getting Started

Start typing to see the magic happen!

> "The best writing tool is the one that gets out of your way."

\`\`\`javascript
console.log('Hello, VividMark!');
\`\`\`
`

const MAX_RECENT_FILES = 10

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      content: DEFAULT_CONTENT,
      filePath: null,
      fileName: 'Untitled.md',
      isDirty: false,
      recentFiles: [],
      isDarkMode: false,
      showSidebar: true,
      viewMode: 'edit',
      activeBlockId: null,

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
      setViewMode: (mode) => set({ viewMode: mode }),
      setActiveBlockId: (id) => set({ activeBlockId: id }),
      resetDocument: () =>
        set({
          content: '',
          filePath: null,
          fileName: 'Untitled.md',
          isDirty: false,
          activeBlockId: null,
        }),
    }),
    {
      name: 'vividmark-storage',
      // 只持久化部分状态
      partialize: (state) => ({
        recentFiles: state.recentFiles,
        isDarkMode: state.isDarkMode,
      }),
    }
  )
)
