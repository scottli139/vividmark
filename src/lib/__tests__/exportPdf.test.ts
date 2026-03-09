import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToPdf, exportCurrentDocument } from '../exportPdf'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock editorStore
vi.mock('../stores/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn(() => ({
      fileName: 'test-document.md',
    })),
  },
}))

describe('exportPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportToPdf', () => {
    it('should call invoke with correct parameters', async () => {
      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValue({ success: true, error: null })

      const params = {
        htmlContent: '<h1>Test</h1>',
        title: 'Test Document',
      }

      const result = await exportToPdf(params)

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('export_pdf', {
        params: {
          html_content: params.htmlContent,
          title: params.title,
        },
      })
    })

    it('should return false when export fails', async () => {
      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValue({ success: false, error: 'Export failed' })

      const result = await exportToPdf({ htmlContent: '<h1>Test</h1>' })

      expect(result).toBe(false)
    })

    it('should return false when invoke throws error', async () => {
      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockRejectedValue(new Error('Network error'))

      const result = await exportToPdf({ htmlContent: '<h1>Test</h1>' })

      expect(result).toBe(false)
    })
  })

  describe('exportCurrentDocument', () => {
    it('should export with file name as title', async () => {
      const mockInvoke = vi.mocked(invoke)
      mockInvoke.mockResolvedValue({ success: true, error: null })

      await exportCurrentDocument()

      expect(mockInvoke).toHaveBeenCalledWith('print_pdf', {
        fileName: 'Untitled',
      })
    })
  })
})
