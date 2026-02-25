import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../editorStore'

describe('editorStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useEditorStore.setState({
      content: '',
      filePath: null,
      fileName: 'Untitled.md',
      isDirty: false,
      recentFiles: [],
      isDarkMode: false,
      showSidebar: true,
      viewMode: 'edit',
      activeBlockId: null,
    })
  })

  describe('document state', () => {
    it('should have empty content after reset', () => {
      const { content } = useEditorStore.getState()
      expect(content).toBe('')
    })

    it('should update content and set dirty flag', () => {
      const store = useEditorStore.getState()
      store.setContent('New content')

      const state = useEditorStore.getState()
      expect(state.content).toBe('New content')
      expect(state.isDirty).toBe(true)
    })

    it('should set file path', () => {
      const store = useEditorStore.getState()
      store.setFilePath('/path/to/file.md')

      expect(useEditorStore.getState().filePath).toBe('/path/to/file.md')
    })

    it('should set file name', () => {
      const store = useEditorStore.getState()
      store.setFileName('test.md')

      expect(useEditorStore.getState().fileName).toBe('test.md')
    })

    it('should set dirty flag', () => {
      const store = useEditorStore.getState()
      store.setDirty(true)

      expect(useEditorStore.getState().isDirty).toBe(true)

      store.setDirty(false)

      expect(useEditorStore.getState().isDirty).toBe(false)
    })

    it('should reset document to initial state', () => {
      const store = useEditorStore.getState()

      store.setContent('Modified content')
      store.setFilePath('/path/to/file.md')
      store.setFileName('modified.md')
      store.setDirty(true)

      store.resetDocument()

      const state = useEditorStore.getState()
      expect(state.content).toBe('')
      expect(state.filePath).toBeNull()
      expect(state.fileName).toBe('Untitled.md')
      expect(state.isDirty).toBe(false)
    })
  })

  describe('recent files', () => {
    it('should add recent file', () => {
      const store = useEditorStore.getState()
      store.addRecentFile('/path/to/file1.md', 'file1.md')

      const state = useEditorStore.getState()
      expect(state.recentFiles).toHaveLength(1)
      expect(state.recentFiles[0].path).toBe('/path/to/file1.md')
      expect(state.recentFiles[0].name).toBe('file1.md')
    })

    it('should add most recent file to the beginning', () => {
      const store = useEditorStore.getState()
      store.addRecentFile('/path/to/file1.md', 'file1.md')
      store.addRecentFile('/path/to/file2.md', 'file2.md')

      const state = useEditorStore.getState()
      expect(state.recentFiles[0].path).toBe('/path/to/file2.md')
      expect(state.recentFiles[1].path).toBe('/path/to/file1.md')
    })

    it('should move existing file to the beginning when added again', () => {
      const store = useEditorStore.getState()
      store.addRecentFile('/path/to/file1.md', 'file1.md')
      store.addRecentFile('/path/to/file2.md', 'file2.md')
      store.addRecentFile('/path/to/file1.md', 'file1.md')

      const state = useEditorStore.getState()
      expect(state.recentFiles).toHaveLength(2)
      expect(state.recentFiles[0].path).toBe('/path/to/file1.md')
    })

    it('should limit recent files to MAX_RECENT_FILES (10)', () => {
      const store = useEditorStore.getState()

      for (let i = 0; i < 15; i++) {
        store.addRecentFile(`/path/to/file${i}.md`, `file${i}.md`)
      }

      const state = useEditorStore.getState()
      expect(state.recentFiles).toHaveLength(10)
      // Most recent should be first
      expect(state.recentFiles[0].path).toBe('/path/to/file14.md')
    })

    it('should clear recent files', () => {
      const store = useEditorStore.getState()

      store.addRecentFile('/path/to/file1.md', 'file1.md')
      store.addRecentFile('/path/to/file2.md', 'file2.md')

      expect(useEditorStore.getState().recentFiles).toHaveLength(2)

      store.clearRecentFiles()

      expect(useEditorStore.getState().recentFiles).toHaveLength(0)
    })

    it('should record lastOpened timestamp', () => {
      const store = useEditorStore.getState()
      const beforeTime = Date.now()

      store.addRecentFile('/path/to/file.md', 'file.md')

      const state = useEditorStore.getState()
      const afterTime = Date.now()
      expect(state.recentFiles[0].lastOpened).toBeGreaterThanOrEqual(beforeTime)
      expect(state.recentFiles[0].lastOpened).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('UI state', () => {
    it('should toggle dark mode', () => {
      const store = useEditorStore.getState()

      expect(store.isDarkMode).toBe(false)

      store.toggleDarkMode()

      expect(useEditorStore.getState().isDarkMode).toBe(true)

      useEditorStore.getState().toggleDarkMode()

      expect(useEditorStore.getState().isDarkMode).toBe(false)
    })

    it('should toggle sidebar', () => {
      const store = useEditorStore.getState()

      expect(store.showSidebar).toBe(true)

      store.toggleSidebar()

      expect(useEditorStore.getState().showSidebar).toBe(false)

      useEditorStore.getState().toggleSidebar()

      expect(useEditorStore.getState().showSidebar).toBe(true)
    })

    it('should set view mode', () => {
      const store = useEditorStore.getState()

      store.setViewMode('preview')

      expect(useEditorStore.getState().viewMode).toBe('preview')

      useEditorStore.getState().setViewMode('split')

      expect(useEditorStore.getState().viewMode).toBe('split')
    })

    it('should set active block id', () => {
      const store = useEditorStore.getState()

      store.setActiveBlockId('block-123')

      expect(useEditorStore.getState().activeBlockId).toBe('block-123')

      useEditorStore.getState().setActiveBlockId(null)

      expect(useEditorStore.getState().activeBlockId).toBeNull()
    })
  })
})
