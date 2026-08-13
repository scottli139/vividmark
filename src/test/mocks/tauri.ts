import { vi } from 'vitest'

// Mock Tauri invoke function
export const mockInvoke = vi.fn()

// Mock Tauri dialog plugin
export const mockOpenDialog = vi.fn()
export const mockSaveDialog = vi.fn()

// Mock Tauri event plugin（原生菜单 listen / 跨窗口广播 emit）
export const mockListen = vi.fn().mockResolvedValue(vi.fn())
export const mockEmit = vi.fn().mockResolvedValue(undefined)

// Mock Tauri window API（多窗口：焦点跟踪 / 关闭拦截 / 标题）
export const mockIsFocused = vi.fn().mockResolvedValue(true)
export const mockOnFocusChanged = vi.fn().mockResolvedValue(vi.fn())
export const mockOnCloseRequested = vi.fn().mockResolvedValue(vi.fn())
export const mockSetTitle = vi.fn().mockResolvedValue(undefined)

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    label: 'main',
    isFocused: mockIsFocused,
    onFocusChanged: mockOnFocusChanged,
    onCloseRequested: mockOnCloseRequested,
    setTitle: mockSetTitle,
  }),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
  emit: mockEmit,
}))

// Setup mocks for Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mockOpenDialog,
  save: mockSaveDialog,
}))

// Helper to reset all Tauri mocks
export function resetTauriMocks() {
  mockInvoke.mockReset()
  mockOpenDialog.mockReset()
  mockSaveDialog.mockReset()
}

// Helper to setup default successful file operations
export function setupDefaultTauriMocks() {
  mockInvoke.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case 'read_file':
        return {
          path: '/test/document.md',
          content: '# Test Document\n\nThis is test content.',
          name: 'document.md',
        }
      case 'save_file':
        return { success: true, error: null }
      case 'print_pdf':
        return { success: true, error: null }
      case 'pdf_export_supported':
        return true
      case 'export_pdf_file':
        return { success: true, error: null }
      default:
        return null
    }
  })

  mockOpenDialog.mockResolvedValue(null)
  mockSaveDialog.mockResolvedValue(null)
}

// Common mock return values
export const mockFileInfo = {
  path: '/test/document.md',
  content: '# Test Document\n\nThis is test content.',
  name: 'document.md',
}

export const mockSaveResult = {
  success: true,
  error: null,
}
