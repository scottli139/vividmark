import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Keep the Tauri mocks ahead of the module that imports Tauri APIs.
import {
  mockInvoke,
  mockOpenDialog,
  mockSaveDialog,
  mockSaveResult,
  resetTauriMocks,
  setupDefaultTauriMocks,
} from '../../test/mocks/tauri'
import { useEditorStore } from '../../stores/editorStore'
import { newFile, openFile, openFileByPath, openFileSmart, saveFile, saveFileAs } from '../fileOps'

describe('fileOps', () => {
  beforeEach(() => {
    resetTauriMocks()
    setupDefaultTauriMocks()
    useEditorStore.setState({
      content: '# Draft',
      filePath: null,
      fileName: 'draft.md',
      isDirty: true,
      recentFiles: [],
    })
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens the selected file and marks the loaded document clean', async () => {
    const file = { path: '/notes/open.md', name: 'open.md', content: '# Opened' }
    mockOpenDialog.mockResolvedValueOnce(file.path)
    mockInvoke.mockResolvedValueOnce(file)

    await openFile()

    expect(mockOpenDialog).toHaveBeenCalledTimes(1)
    expect(mockInvoke).toHaveBeenCalledWith('read_file', { path: file.path })
    expect(useEditorStore.getState()).toMatchObject({
      content: file.content,
      filePath: file.path,
      fileName: file.name,
      isDirty: false,
      recentFiles: [expect.objectContaining({ path: file.path, name: file.name })],
    })
  })

  it('does not read a file when the open dialog is cancelled', async () => {
    mockOpenDialog.mockResolvedValueOnce(null)

    await openFile()

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(useEditorStore.getState()).toMatchObject({
      content: '# Draft',
      filePath: null,
      fileName: 'draft.md',
      isDirty: true,
    })
  })

  it('keeps the current document when opening a path fails', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('file not found'))

    await expect(openFileByPath('/notes/missing.md')).resolves.toBe(false)

    expect(useEditorStore.getState()).toMatchObject({
      content: '# Draft',
      filePath: null,
      fileName: 'draft.md',
      isDirty: true,
      recentFiles: [],
    })
  })

  it('saves the current path and clears the dirty flag after success', async () => {
    useEditorStore.setState({ filePath: '/notes/current.md', isDirty: true })

    await expect(saveFile()).resolves.toBe(true)

    expect(mockInvoke).toHaveBeenCalledWith('save_file', {
      path: '/notes/current.md',
      content: '# Draft',
    })
    expect(useEditorStore.getState().isDirty).toBe(false)
  })

  it('keeps the dirty flag when saving the current path fails', async () => {
    useEditorStore.setState({ filePath: '/notes/current.md', isDirty: true })
    mockInvoke.mockResolvedValueOnce({ success: false, error: 'permission denied' })

    await expect(saveFile()).resolves.toBe(false)

    expect(useEditorStore.getState()).toMatchObject({
      filePath: '/notes/current.md',
      isDirty: true,
    })
  })

  it('saves an untitled document through Save As and updates its path', async () => {
    mockSaveDialog.mockResolvedValueOnce('/notes/saved.md')
    mockInvoke.mockResolvedValueOnce(mockSaveResult)

    await expect(saveFile()).resolves.toBe(true)

    expect(mockSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'draft.md' })
    )
    expect(mockInvoke).toHaveBeenCalledWith('save_file', {
      path: '/notes/saved.md',
      content: '# Draft',
    })
    expect(useEditorStore.getState()).toMatchObject({
      filePath: '/notes/saved.md',
      fileName: 'saved.md',
      isDirty: false,
    })
  })

  it('does not write or change the document when Save As is cancelled', async () => {
    mockSaveDialog.mockResolvedValueOnce(null)

    await expect(saveFileAs()).resolves.toBe(false)

    expect(mockInvoke).not.toHaveBeenCalled()
    expect(useEditorStore.getState()).toMatchObject({
      filePath: null,
      fileName: 'draft.md',
      isDirty: true,
    })
  })

  it('keeps document metadata and dirty state when Save As fails', async () => {
    mockSaveDialog.mockResolvedValueOnce('/notes/saved.md')
    mockInvoke.mockResolvedValueOnce({ success: false, error: 'disk full' })

    await expect(saveFileAs()).resolves.toBe(false)

    expect(useEditorStore.getState()).toMatchObject({
      filePath: null,
      fileName: 'draft.md',
      isDirty: true,
    })
  })

  it('routes a selected file to its owning window in smart-open mode', async () => {
    mockOpenDialog.mockResolvedValueOnce('/notes/other-window.md')

    await openFileSmart()

    expect(mockInvoke).toHaveBeenCalledWith('route_open', {
      paths: ['/notes/other-window.md'],
    })
    expect(mockInvoke).not.toHaveBeenCalledWith('read_file', expect.anything())
  })

  it('resets the current document when creating a new file', () => {
    useEditorStore.setState({ filePath: '/notes/current.md', fileName: 'current.md' })

    newFile()

    expect(useEditorStore.getState()).toMatchObject({
      content: '',
      filePath: null,
      fileName: 'Untitled.md',
      isDirty: false,
    })
  })
})
