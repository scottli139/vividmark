import { open } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '../stores/editorStore'

/** 弹出系统目录选择框，选中后打开文件树（未选择则不动） */
export async function openFolderDialog(): Promise<void> {
  const selected = await open({
    directory: true,
    multiple: false,
  })

  if (selected && typeof selected === 'string') {
    const store = useEditorStore.getState()
    store.setOpenedFolder(selected)
    store.setSidebarTab('files')
    if (!store.showSidebar) store.toggleSidebar()
  }
}
