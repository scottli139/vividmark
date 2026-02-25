import { vi } from 'vitest'

// Mock Tauri invoke function
export const mockInvoke = vi.fn()

// Mock Tauri dialog plugin
export const mockOpenDialog = vi.fn()
export const mockSaveDialog = vi.fn()

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
