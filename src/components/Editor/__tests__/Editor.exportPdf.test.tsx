import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { Editor } from '../Editor'
import { useEditorStore } from '../../../stores/editorStore'

// Mock Tauri APIs
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock exportPdf module
const mockExportCurrentDocument = vi.fn()
vi.mock('../../../lib/exportPdf', () => ({
  exportCurrentDocument: (...args: unknown[]) => mockExportCurrentDocument(...args),
}))

// Mock markdown parser
vi.mock('../../../lib/markdown/parser', () => ({
  parseMarkdownAsync: vi.fn((content: string) => Promise.resolve(`<div>${content}</div>`)),
  preprocessImages: vi.fn((content: string) => Promise.resolve(content)),
}))

describe('Editor - Export PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useEditorStore.setState({
      content: '# Test Document\n\nThis is a test.',
      filePath: null,
      fileName: 'test.md',
      isDirty: false,
      viewMode: 'source',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should listen for editor-export-pdf event', async () => {
    mockExportCurrentDocument.mockResolvedValue(true)

    render(<Editor />)

    // Dispatch the export PDF request event
    window.dispatchEvent(new CustomEvent('editor-export-pdf'))

    // Wait for the export function to be called
    await waitFor(() => {
      expect(mockExportCurrentDocument).toHaveBeenCalled()
    })
  })

  it('should call export function when event is dispatched', async () => {
    mockExportCurrentDocument.mockResolvedValue(true)

    render(<Editor />)

    // Wait for initial render
    await waitFor(() => {
      expect(mockExportCurrentDocument).not.toHaveBeenCalled()
    })

    // Dispatch the export PDF request event
    window.dispatchEvent(new CustomEvent('editor-export-pdf'))

    // Wait for the export function to be called
    await waitFor(() => {
      expect(mockExportCurrentDocument).toHaveBeenCalledTimes(1)
    })
  })

  it('should handle export errors gracefully', async () => {
    // Mock export function to throw error
    mockExportCurrentDocument.mockRejectedValue(new Error('Export failed'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<Editor />)

    // Dispatch the export PDF request event
    window.dispatchEvent(new CustomEvent('editor-export-pdf'))

    // Wait and verify no unhandled errors
    await waitFor(() => {
      expect(mockExportCurrentDocument).toHaveBeenCalled()
    })

    consoleSpy.mockRestore()
  })
})
