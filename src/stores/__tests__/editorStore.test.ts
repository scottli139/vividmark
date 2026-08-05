import { describe, it, expect, beforeEach, vi } from 'vitest'
import { migratePersistedState, useEditorStore } from '../editorStore'

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
      themeMode: 'system',
      showSidebar: true,
      sidebarTab: 'outline',
      sidebarWidth: 224,
      viewMode: 'wysiwyg',
      activeBlockId: null,
      zoomLevel: 100,
      isSettingsOpen: false,
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

    it('should rename recent file entry', () => {
      const store = useEditorStore.getState()

      store.addRecentFile('/path/to/file1.md', 'file1.md')
      store.addRecentFile('/path/to/file2.md', 'file2.md')

      store.renameRecentFile('/path/to/file1.md', '/path/to/renamed.md', 'renamed.md')

      const state = useEditorStore.getState()
      expect(state.recentFiles).toHaveLength(2)
      expect(state.recentFiles[1].path).toBe('/path/to/renamed.md')
      expect(state.recentFiles[1].name).toBe('renamed.md')
      expect(state.recentFiles[0].path).toBe('/path/to/file2.md')
    })

    it('should not modify entries when rename target does not exist', () => {
      const store = useEditorStore.getState()

      store.addRecentFile('/path/to/file1.md', 'file1.md')
      store.renameRecentFile('/path/to/missing.md', '/path/to/new.md', 'new.md')

      const state = useEditorStore.getState()
      expect(state.recentFiles[0].path).toBe('/path/to/file1.md')
    })
  })

  describe('zoom level', () => {
    it('should have default zoom level of 100', () => {
      const { zoomLevel } = useEditorStore.getState()
      expect(zoomLevel).toBe(100)
    })

    it('should zoom in by 10%', () => {
      const store = useEditorStore.getState()

      store.zoomIn()

      expect(useEditorStore.getState().zoomLevel).toBe(110)
    })

    it('should zoom out by 10%', () => {
      const store = useEditorStore.getState()

      store.zoomOut()

      expect(useEditorStore.getState().zoomLevel).toBe(90)
    })

    it('should reset zoom to 100', () => {
      const store = useEditorStore.getState()

      store.setZoomLevel(150)
      expect(useEditorStore.getState().zoomLevel).toBe(150)

      store.zoomReset()

      expect(useEditorStore.getState().zoomLevel).toBe(100)
    })

    it('should set zoom level directly', () => {
      const store = useEditorStore.getState()

      store.setZoomLevel(125)

      expect(useEditorStore.getState().zoomLevel).toBe(125)
    })

    it('should not exceed max zoom level of 200', () => {
      const store = useEditorStore.getState()

      store.setZoomLevel(195)
      store.zoomIn()

      expect(useEditorStore.getState().zoomLevel).toBe(200)

      store.zoomIn()
      expect(useEditorStore.getState().zoomLevel).toBe(200)
    })

    it('should not go below min zoom level of 50', () => {
      const store = useEditorStore.getState()

      store.setZoomLevel(55)
      store.zoomOut()

      expect(useEditorStore.getState().zoomLevel).toBe(50)

      store.zoomOut()
      expect(useEditorStore.getState().zoomLevel).toBe(50)
    })

    it('should clamp zoom level when set directly', () => {
      const store = useEditorStore.getState()

      store.setZoomLevel(250)
      expect(useEditorStore.getState().zoomLevel).toBe(200)

      store.setZoomLevel(10)
      expect(useEditorStore.getState().zoomLevel).toBe(50)
    })
  })

  describe('UI state', () => {
    it('should toggle dark mode', () => {
      const store = useEditorStore.getState()

      expect(store.isDarkMode).toBe(false)

      store.toggleDarkMode()

      expect(useEditorStore.getState().isDarkMode).toBe(true)
      expect(useEditorStore.getState().themeMode).toBe('dark')

      useEditorStore.getState().toggleDarkMode()

      expect(useEditorStore.getState().isDarkMode).toBe(false)
      expect(useEditorStore.getState().themeMode).toBe('light')
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

      // Default should be wysiwyg
      expect(store.viewMode).toBe('wysiwyg')

      store.setViewMode('preview')

      expect(useEditorStore.getState().viewMode).toBe('preview')

      useEditorStore.getState().setViewMode('split')

      expect(useEditorStore.getState().viewMode).toBe('split')

      useEditorStore.getState().setViewMode('source')

      expect(useEditorStore.getState().viewMode).toBe('source')
    })

    it('should set active block id', () => {
      const store = useEditorStore.getState()

      store.setActiveBlockId('block-123')

      expect(useEditorStore.getState().activeBlockId).toBe('block-123')

      useEditorStore.getState().setActiveBlockId(null)

      expect(useEditorStore.getState().activeBlockId).toBeNull()
    })
  })

  // matchMedia mock（src/test/setup.ts）默认返回 matches: false，即系统偏好亮色
  describe('theme mode', () => {
    it('should default to system theme mode', () => {
      expect(useEditorStore.getState().themeMode).toBe('system')
    })

    it('setThemeMode should update themeMode and derive isDarkMode', () => {
      useEditorStore.getState().setThemeMode('dark')

      expect(useEditorStore.getState().themeMode).toBe('dark')
      expect(useEditorStore.getState().isDarkMode).toBe(true)

      useEditorStore.getState().setThemeMode('light')

      expect(useEditorStore.getState().themeMode).toBe('light')
      expect(useEditorStore.getState().isDarkMode).toBe(false)
    })

    it('setThemeMode system should follow system preference', () => {
      useEditorStore.getState().setThemeMode('dark')
      useEditorStore.getState().setThemeMode('system')

      // 系统偏好为亮色（matchMedia mock matches: false）
      expect(useEditorStore.getState().isDarkMode).toBe(false)
    })

    it('setSystemDark should apply only in system mode', () => {
      useEditorStore.getState().setThemeMode('system')
      useEditorStore.getState().setSystemDark(true)

      expect(useEditorStore.getState().isDarkMode).toBe(true)

      // 显式 light 模式下系统偏好变化不影响实际主题
      useEditorStore.getState().setThemeMode('light')
      useEditorStore.getState().setSystemDark(true)

      expect(useEditorStore.getState().isDarkMode).toBe(false)
    })

    it('toggleDarkMode should switch between explicit light and dark', () => {
      useEditorStore.getState().setThemeMode('system')

      useEditorStore.getState().toggleDarkMode()
      expect(useEditorStore.getState().themeMode).toBe('dark')

      useEditorStore.getState().toggleDarkMode()
      expect(useEditorStore.getState().themeMode).toBe('light')
    })

    it('migrate should convert v0 isDarkMode to themeMode', () => {
      const dark = migratePersistedState({ isDarkMode: true, recentFiles: [] }, 0)
      expect(dark.themeMode).toBe('dark')
      expect(dark).not.toHaveProperty('isDarkMode')

      const light = migratePersistedState({ isDarkMode: false, recentFiles: [] }, 0)
      expect(light.themeMode).toBe('light')
      expect(light).not.toHaveProperty('isDarkMode')
    })

    it('migrate should pass through current version state', () => {
      const state = { themeMode: 'dark' as const, recentFiles: [] }

      expect(migratePersistedState(state, 1)).toEqual(state)
    })

    it('partialize should persist themeMode instead of isDarkMode', () => {
      const { partialize } = useEditorStore.persist.getOptions()
      expect(partialize).toBeTypeOf('function')

      const partial = partialize?.(useEditorStore.getState())
      expect(partial).toHaveProperty('themeMode')
      expect(partial).not.toHaveProperty('isDarkMode')
    })

    it('merge should re-derive isDarkMode from persisted themeMode', () => {
      const { merge } = useEditorStore.persist.getOptions()
      expect(merge).toBeTypeOf('function')

      const merged = merge?.({ themeMode: 'dark' }, useEditorStore.getState())
      expect(merged?.themeMode).toBe('dark')
      expect(merged?.isDarkMode).toBe(true)
    })
  })

  describe('settings dialog', () => {
    it('should default isSettingsOpen to false', () => {
      expect(useEditorStore.getState().isSettingsOpen).toBe(false)
    })

    it('should set isSettingsOpen', () => {
      useEditorStore.getState().setSettingsOpen(true)
      expect(useEditorStore.getState().isSettingsOpen).toBe(true)

      useEditorStore.getState().setSettingsOpen(false)
      expect(useEditorStore.getState().isSettingsOpen).toBe(false)
    })

    it('partialize should persist showSidebar but not isSettingsOpen', () => {
      const { partialize } = useEditorStore.persist.getOptions()
      expect(partialize).toBeTypeOf('function')

      const partial = partialize?.(useEditorStore.getState())
      expect(partial).toHaveProperty('showSidebar')
      expect(partial).not.toHaveProperty('isSettingsOpen')
    })
  })

  describe('sidebar', () => {
    it('should default sidebarTab to outline', () => {
      expect(useEditorStore.getState().sidebarTab).toBe('outline')
    })

    it('should set sidebar tab', () => {
      useEditorStore.getState().setSidebarTab('files')
      expect(useEditorStore.getState().sidebarTab).toBe('files')

      useEditorStore.getState().setSidebarTab('outline')
      expect(useEditorStore.getState().sidebarTab).toBe('outline')
    })

    it('should default sidebarWidth to 224', () => {
      expect(useEditorStore.getState().sidebarWidth).toBe(224)
    })

    it('should set sidebar width', () => {
      useEditorStore.getState().setSidebarWidth(300)
      expect(useEditorStore.getState().sidebarWidth).toBe(300)
    })

    it('should clamp sidebar width to [180, 400]', () => {
      useEditorStore.getState().setSidebarWidth(100)
      expect(useEditorStore.getState().sidebarWidth).toBe(180)

      useEditorStore.getState().setSidebarWidth(999)
      expect(useEditorStore.getState().sidebarWidth).toBe(400)
    })

    it('partialize should persist sidebarTab and sidebarWidth', () => {
      const { partialize } = useEditorStore.persist.getOptions()
      expect(partialize).toBeTypeOf('function')

      const partial = partialize?.(useEditorStore.getState())
      expect(partial).toHaveProperty('sidebarTab', 'outline')
      expect(partial).toHaveProperty('sidebarWidth', 224)
    })
  })

  describe('activeHeadingIndex', () => {
    beforeEach(() => {
      useEditorStore.setState({ activeHeadingIndex: null })
    })

    it('should default to null', () => {
      expect(useEditorStore.getState().activeHeadingIndex).toBeNull()
    })

    it('should set active heading index', () => {
      useEditorStore.getState().setActiveHeadingIndex(2)
      expect(useEditorStore.getState().activeHeadingIndex).toBe(2)

      useEditorStore.getState().setActiveHeadingIndex(null)
      expect(useEditorStore.getState().activeHeadingIndex).toBeNull()
    })

    it('should skip redundant set when value is unchanged', () => {
      useEditorStore.getState().setActiveHeadingIndex(2)

      const listener = vi.fn()
      const unsubscribe = useEditorStore.subscribe(listener)

      useEditorStore.getState().setActiveHeadingIndex(2)
      expect(listener).not.toHaveBeenCalled()

      useEditorStore.getState().setActiveHeadingIndex(3)
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()
    })

    it('should reset to null on resetDocument', () => {
      useEditorStore.getState().setActiveHeadingIndex(5)
      useEditorStore.getState().resetDocument('x')
      expect(useEditorStore.getState().activeHeadingIndex).toBeNull()
    })

    it('partialize should not persist activeHeadingIndex', () => {
      const { partialize } = useEditorStore.persist.getOptions()
      const partial = partialize?.(useEditorStore.getState())
      expect(partial).not.toHaveProperty('activeHeadingIndex')
    })
  })
})
