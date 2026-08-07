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
      const count = options?.count ?? ''
      const line = options?.line ?? ''
      const col = options?.col ?? ''
      const name = options?.name ?? ''
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
        'toolbar.tooltip.tasklist': 'Task List',
        'toolbar.tooltip.orderedList': 'Ordered List',
        'toolbar.tooltip.codeBlock': 'Code Block',
        'toolbar.tooltip.admonition': 'Admonition',
        'toolbar.tooltip.heading': 'Heading',
        'toolbar.tooltip.moreFormatting': 'More Formatting',
        'toolbar.tooltip.insert': 'Insert',
        'toolbar.tooltip.toggleDarkMode': 'Toggle Dark Mode',
        'toolbar.tooltip.zoomIn': shortcut ? `Zoom In (${shortcut})` : 'Zoom In',
        'toolbar.tooltip.zoomOut': shortcut ? `Zoom Out (${shortcut})` : 'Zoom Out',
        'toolbar.tooltip.zoomReset': shortcut ? `Reset Zoom (${shortcut})` : 'Reset Zoom',
        'toolbar.tooltip.exportPdf': shortcut ? `Export PDF (${shortcut})` : 'Export PDF',
        'toolbar.viewMode.wysiwyg': 'WYSIWYG',
        'toolbar.viewMode.source': 'Source',
        'toolbar.viewMode.split': 'Split',
        'toolbar.viewMode.preview': 'Preview',
        'toolbar.more': 'More',
        'settings.title': 'Settings',
        'settings.appearance': 'Appearance',
        'settings.theme.light': 'Light',
        'settings.theme.dark': 'Dark',
        'settings.theme.system': 'System',
        'settings.language': 'Language',
        'settings.sidebar': 'Sidebar',
        'settings.showSidebar': 'Show Sidebar',
        'settings.close': 'Close',
        'app.untitled': 'Untitled.md',
        'language.title': 'Language',
        'language.en': 'EN',
        'language.zhCN': '中',
        'dialog.confirmDiscard': 'Discard unsaved changes?',
        'dialog.insertTable': 'Insert Table',
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Confirm',
        'dialog.close': 'Close',
        'dialog.insert': 'Insert',
        'dialog.rows': 'Rows (excluding header)',
        'dialog.columns': 'Columns',
        'dialog.preview': 'Preview',
        'dialog.insertAdmonition': 'Insert Admonition',
        'dialog.admonitionType': 'Type',
        'dialog.admonitionTitle': 'Custom title (optional)',
        'sidebar.files': 'Files',
        'sidebar.recentFiles': 'Recent Files',
        'sidebar.outline': 'Outline',
        'sidebar.clear': 'Clear',
        'sidebar.clearTooltip': 'Clear recent files',
        'sidebar.noRecentFiles': 'No recent files',
        'sidebar.filterRecent': 'Filter recent files...',
        'sidebar.noHeadings': 'No headings',
        'sidebar.collapse': 'Collapse',
        'sidebar.expand': 'Expand',
        'sidebar.removeFromRecent': 'Remove from List',
        'sidebar.words': 'Words:',
        'sidebar.chars': 'Chars:',
        'statusBar.words': `Words: ${count}`,
        'statusBar.chars': `Chars: ${count}`,
        'statusBar.cursor': `Ln ${line}, Col ${col}`,
        'statusBar.zoomReset': 'Reset zoom',
        'messages.invalidFileType': 'Please drop a Markdown file (.md, .markdown, .txt)',
        'messages.openFileFailed': 'Failed to open file',
        'messages.unknownFile': 'Unknown file',
        'fileTree.openFolder': 'Open Folder',
        'fileTree.closeFolder': 'Close Folder',
        'fileTree.loading': 'Loading...',
        'fileTree.emptyFolder': 'Empty folder',
        'fileTree.newFile': 'New File',
        'fileTree.newFolder': 'New Folder',
        'fileTree.rename': 'Rename',
        'fileTree.delete': 'Delete',
        'fileTree.filterPlaceholder': 'Filter files...',
        'fileTree.noMatches': 'No matching files',
        'fileTree.confirmDeleteFile': `Delete "${name}"?`,
        'fileTree.confirmDeleteFolder': `Delete folder "${name}" and all its contents?`,
        'fileTree.open': 'Open',
        'fileTree.duplicate': 'Duplicate',
        'fileTree.duplicateFailed': `Failed to duplicate "${name}": too many copies`,
        'fileTree.copyPath': 'Copy File Path',
        'fileTree.revealFinder': 'Reveal in Finder',
        'fileTree.revealFileManager': 'Reveal in File Manager',
        'contextMenu.undo': 'Undo',
        'contextMenu.redo': 'Redo',
        'contextMenu.cut': 'Cut',
        'contextMenu.copy': 'Copy',
        'contextMenu.paste': 'Paste',
        'contextMenu.selectAll': 'Select All',
        'contextMenu.find': 'Find',
        'contextMenu.bold': 'Bold',
        'contextMenu.italic': 'Italic',
        'contextMenu.strikethrough': 'Strikethrough',
        'contextMenu.inlineCode': 'Inline Code',
        'contextMenu.link': 'Link',
        'contextMenu.openLink': 'Open Link',
        'contextMenu.copyLink': 'Copy Link',
        'contextMenu.removeLink': 'Remove Link',
        'contextMenu.copyImageAddress': 'Copy Image Address',
        'contextMenu.deleteImage': 'Delete Image',
        'contextMenu.copyCode': 'Copy Code',
        'contextMenu.exportPdf': 'Export PDF',
        'contextMenu.addRowAbove': 'Add Row Above',
        'contextMenu.addRowBelow': 'Add Row Below',
        'contextMenu.addColumnLeft': 'Add Column Left',
        'contextMenu.addColumnRight': 'Add Column Right',
        'contextMenu.deleteRow': 'Delete Row',
        'contextMenu.deleteColumn': 'Delete Column',
        'contextMenu.deleteTable': 'Delete Table',
        'contextMenu.paragraph': 'Paragraph',
        'contextMenu.format': 'Format',
        'contextMenu.insert': 'Insert',
        'contextMenu.normalText': 'Normal',
        'contextMenu.heading1': 'Heading 1',
        'contextMenu.heading2': 'Heading 2',
        'contextMenu.heading3': 'Heading 3',
        'contextMenu.quote': 'Quote',
        'contextMenu.bulletList': 'Bullet List',
        'contextMenu.taskList': 'Task List',
        'contextMenu.codeBlock': 'Code Block',
        'contextMenu.insertImage': 'Image',
        'contextMenu.insertTable': 'Table',
        'contextMenu.horizontalRule': 'Horizontal Rule',
        'contextMenu.insertParagraphAbove': 'Insert Paragraph Above',
        'contextMenu.insertParagraphBelow': 'Insert Paragraph Below',
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

// ==================== CodeMirror 6 jsdom polyfills ====================
// jsdom 未实现布局相关 API，CM6 挂载时需要这些 polyfill

// Range.prototype.getClientRects / getBoundingClientRect
if (typeof Range !== 'undefined') {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = function () {
      return {
        length: 0,
        item: () => null,
        [Symbol.iterator]: [][Symbol.iterator],
      } as unknown as DOMRectList
    }
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect
    }
  }
}

// Element.prototype.scrollIntoView（jsdom 未实现）
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Element.prototype.scrollTo（jsdom 未实现）
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {}
}

// requestAnimationFrame（vitest jsdom 通常具备，缺失时兜底）
if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0) as unknown as number
  window.cancelAnimationFrame = (id: number) => clearTimeout(id)
}
