import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockInvoke, mockSaveDialog } from '../../test/mocks/tauri'

// alertDialog / parser 的 mock 实例需要穿透 vi.resetModules，用 hoisted 持有
const { mockAlertDialog, mockParseMarkdownAsync } = vi.hoisted(() => ({
  mockAlertDialog: vi.fn(),
  mockParseMarkdownAsync: vi.fn(),
}))

vi.mock('../dialog', () => ({
  alertDialog: mockAlertDialog,
}))

vi.mock('../markdown/parser', () => ({
  parseMarkdownAsync: mockParseMarkdownAsync,
}))

// exportPdf 模块内有平台支持性缓存，必须每个用例重新 import 全新模块
async function loadExportPdf() {
  vi.resetModules()
  const store = await import('../../stores/editorStore')
  store.useEditorStore.setState({
    fileName: 'test-document.md',
    filePath: '/test/test-document.md',
    content: '# Hello',
  })
  return import('../exportPdf')
}

function simulateTauri() {
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
}

function simulateBrowser() {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  delete (window as unknown as Record<string, unknown>).__TAURI__
}

describe('exportPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockParseMarkdownAsync.mockResolvedValue('<h1>Mock</h1>')
    mockAlertDialog.mockResolvedValue(undefined)
    mockSaveDialog.mockResolvedValue('/tmp/out.pdf')
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case 'pdf_export_supported':
          return true
        case 'export_pdf_file':
        case 'print_pdf':
          return { success: true, error: null }
        default:
          return null
      }
    })
    simulateTauri()
  })

  afterEach(() => {
    simulateBrowser()
  })

  describe('printToPdf（回退路径）', () => {
    it('calls print_pdf with the base file name', async () => {
      const { printToPdf } = await loadExportPdf()

      const result = await printToPdf()

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('print_pdf', {
        fileName: 'test-document',
      })
    })

    it('returns false when print fails', async () => {
      mockInvoke.mockImplementation(async (cmd: string) =>
        cmd === 'print_pdf' ? { success: false, error: 'boom' } : null
      )
      const { printToPdf } = await loadExportPdf()

      expect(await printToPdf()).toBe(false)
    })

    it('returns false when invoke throws', async () => {
      mockInvoke.mockRejectedValue(new Error('ipc error'))
      const { printToPdf } = await loadExportPdf()

      expect(await printToPdf()).toBe(false)
    })
  })

  describe('exportCurrentDocument（Typora 式直存）', () => {
    it('save dialog → export_pdf_file with rendered HTML', async () => {
      const { exportCurrentDocument } = await loadExportPdf()

      const result = await exportCurrentDocument()

      expect(result).toBe(true)
      expect(mockSaveDialog).toHaveBeenCalledWith({
        defaultPath: 'test-document.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      expect(mockInvoke).toHaveBeenCalledWith('export_pdf_file', {
        params: expect.objectContaining({
          outputPath: '/tmp/out.pdf',
          title: 'test-document',
        }),
      })
      // HTML 结构：markdown-body 包装 + 解析结果 + 导出样式
      const call = mockInvoke.mock.calls.find(([cmd]) => cmd === 'export_pdf_file')
      const html = (call?.[1] as { params: { html: string } }).params.html
      expect(html).toContain('<h1>Mock</h1>')
      expect(html).toContain('class="markdown-body"')
      expect(html).toContain('@page')
      expect(html).toContain('<title>test-document</title>')
      expect(html).not.toContain('class="dark"')
    })

    it('does nothing when the save dialog is cancelled', async () => {
      mockSaveDialog.mockResolvedValue(null)
      const { exportCurrentDocument } = await loadExportPdf()

      const result = await exportCurrentDocument()

      expect(result).toBe(false)
      expect(mockInvoke).not.toHaveBeenCalledWith('export_pdf_file', expect.anything())
    })

    it('falls back to print dialog when platform is unsupported', async () => {
      mockInvoke.mockImplementation(async (cmd: string) =>
        cmd === 'pdf_export_supported' ? false : { success: true, error: null }
      )
      const { exportCurrentDocument } = await loadExportPdf()

      const result = await exportCurrentDocument()

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('print_pdf', { fileName: 'test-document' })
      expect(mockInvoke).not.toHaveBeenCalledWith('export_pdf_file', expect.anything())
      expect(mockSaveDialog).not.toHaveBeenCalled()
    })

    it('falls back to print dialog when export_pdf_file reports unsupported at runtime', async () => {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'pdf_export_supported') return true
        if (cmd === 'export_pdf_file')
          return { success: false, error: 'unsupported: WebView2 runtime too old' }
        return { success: true, error: null }
      })
      const { exportCurrentDocument } = await loadExportPdf()

      const result = await exportCurrentDocument()

      expect(result).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('print_pdf', { fileName: 'test-document' })
      expect(mockAlertDialog).not.toHaveBeenCalled()
    })

    it('alerts on export failure', async () => {
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'pdf_export_supported') return true
        if (cmd === 'export_pdf_file') return { success: false, error: 'disk full' }
        return null
      })
      const { exportCurrentDocument } = await loadExportPdf()

      const result = await exportCurrentDocument()

      expect(result).toBe(false)
      expect(mockAlertDialog).toHaveBeenCalledTimes(1)
      expect(mockInvoke).not.toHaveBeenCalledWith('print_pdf', expect.anything())
    })

    it('uses window.print in browser environment', async () => {
      simulateBrowser()
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
      const { exportCurrentDocument } = await loadExportPdf()

      const result = await exportCurrentDocument()

      expect(result).toBe(true)
      expect(printSpy).toHaveBeenCalledTimes(1)
      expect(mockInvoke).not.toHaveBeenCalled()
      printSpy.mockRestore()
    })
  })
})
