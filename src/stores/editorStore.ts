import { create } from 'zustand'

export interface EditorState {
  // 文档状态
  content: string
  filePath: string | null
  fileName: string
  isDirty: boolean

  // UI 状态
  isDarkMode: boolean
  showSidebar: boolean
  viewMode: 'edit' | 'preview' | 'split'

  // Actions
  setContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setFileName: (name: string) => void
  setDirty: (dirty: boolean) => void
  toggleDarkMode: () => void
  toggleSidebar: () => void
  setViewMode: (mode: 'edit' | 'preview' | 'split') => void
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

export const useEditorStore = create<EditorState>((set) => ({
  content: DEFAULT_CONTENT,
  filePath: null,
  fileName: 'Untitled.md',
  isDirty: false,
  isDarkMode: false,
  showSidebar: true,
  viewMode: 'edit',

  setContent: (content) => set({ content, isDirty: true }),
  setFilePath: (path) => set({ filePath: path }),
  setFileName: (name) => set({ fileName: name }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  setViewMode: (mode) => set({ viewMode: mode }),
  resetDocument: () => set({
    content: '',
    filePath: null,
    fileName: 'Untitled.md',
    isDirty: false
  })
}))
