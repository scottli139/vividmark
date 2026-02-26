import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock navigator.platform for consistent testing
Object.defineProperty(navigator, 'platform', {
  value: 'MacIntel',
  writable: true,
})

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      const shortcut = options?.shortcut || ''
      const number = options?.number || ''
      // Handle interpolation for colHeader
      if (key === 'dialog.colHeader') {
        return `Col ${number}`
      }
      const translations: Record<string, string> = {
        'toolbar.tooltip.toggleSidebar': 'Toggle Sidebar',
        'toolbar.tooltip.newFile': shortcut ? `New File (${shortcut})` : 'New File',
        'toolbar.tooltip.openFile': shortcut ? `Open File (${shortcut})` : 'Open File',
        'toolbar.tooltip.save': shortcut ? `Save (${shortcut})` : 'Save',
        'toolbar.tooltip.undo': shortcut ? `Undo (${shortcut})` : 'Undo',
        'toolbar.tooltip.redo': shortcut ? `Redo (${shortcut})` : 'Redo',
        'toolbar.tooltip.bold': shortcut ? `Bold (${shortcut})` : 'Bold',
        'toolbar.tooltip.italic': shortcut ? `Italic (${shortcut})` : 'Italic',
        'toolbar.tooltip.strikethrough': 'Strikethrough',
        'toolbar.tooltip.inlineCode': 'Inline Code',
        'toolbar.tooltip.link': 'Link',
        'toolbar.tooltip.insertImage': 'Insert Image',
        'toolbar.tooltip.insertTable': 'Insert Table',
        'toolbar.tooltip.heading1': 'Heading 1',
        'toolbar.tooltip.heading2': 'Heading 2',
        'toolbar.tooltip.heading3': 'Heading 3',
        'toolbar.tooltip.quote': 'Quote',
        'toolbar.tooltip.list': 'List',
        'toolbar.tooltip.codeBlock': 'Code Block',
        'toolbar.tooltip.toggleDarkMode': 'Toggle Dark Mode',
        'toolbar.viewMode.source': 'Source',
        'toolbar.viewMode.split': 'Split',
        'toolbar.viewMode.preview': 'Preview',
        'dialog.confirmDiscard': 'Discard unsaved changes?',
        'dialog.insertTable': 'Insert Table',
        'dialog.cancel': 'Cancel',
        'dialog.insert': 'Insert',
        'dialog.rows': 'Rows (excluding header)',
        'dialog.columns': 'Columns',
        'dialog.preview': 'Preview',
        'sidebar.currentFile': 'Current File',
        'sidebar.recentFiles': 'Recent Files',
        'sidebar.outline': 'Outline',
        'sidebar.clear': 'Clear',
        'sidebar.clearTooltip': 'Clear recent files',
        'sidebar.noRecentFiles': 'No recent files',
        'sidebar.noHeadings': 'No headings',
        'sidebar.words': 'Words:',
        'sidebar.chars': 'Chars:',
        'messages.invalidFileType': 'Please drop a Markdown file (.md, .markdown, .txt)',
        'messages.openFileFailed': 'Failed to open file',
        'messages.unknownFile': 'Unknown file',
      }
      return translations[key] || key
    },
    i18n: {
      changeLanguage: vi.fn(),
      language: 'en',
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock confirm
window.confirm = vi.fn(() => true)

// Mock alert
window.alert = vi.fn()

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
}
window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
})
