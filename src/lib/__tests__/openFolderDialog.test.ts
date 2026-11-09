import { beforeEach, describe, expect, it } from 'vitest'
import { mockOpenDialog, resetTauriMocks, setupDefaultTauriMocks } from '../../test/mocks/tauri'
import { useEditorStore } from '../../stores/editorStore'
import { openFolderDialog } from '../openFolderDialog'

describe('openFolderDialog', () => {
  beforeEach(() => {
    resetTauriMocks()
    setupDefaultTauriMocks()
    useEditorStore.setState({
      openedFolder: null,
      showSidebar: true,
      sidebarTab: 'outline',
    })
  })

  it('opens the selected folder and switches to the file tree', async () => {
    mockOpenDialog.mockResolvedValueOnce('/notes')

    await openFolderDialog()

    expect(mockOpenDialog).toHaveBeenCalledWith({ directory: true, multiple: false })
    expect(useEditorStore.getState()).toMatchObject({
      openedFolder: '/notes',
      showSidebar: true,
      sidebarTab: 'files',
    })
  })

  it('reveals a hidden sidebar when opening a folder', async () => {
    useEditorStore.setState({ showSidebar: false })
    mockOpenDialog.mockResolvedValueOnce('/notes')

    await openFolderDialog()

    expect(useEditorStore.getState()).toMatchObject({
      openedFolder: '/notes',
      showSidebar: true,
      sidebarTab: 'files',
    })
  })

  it('keeps the current folder and sidebar state when cancelled', async () => {
    useEditorStore.setState({
      openedFolder: '/current',
      showSidebar: false,
      sidebarTab: 'outline',
    })
    mockOpenDialog.mockResolvedValueOnce(null)

    await openFolderDialog()

    expect(useEditorStore.getState()).toMatchObject({
      openedFolder: '/current',
      showSidebar: false,
      sidebarTab: 'outline',
    })
  })
})
