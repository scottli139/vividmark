import { open } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '../stores/editorStore'

/** 弹出系统目录选择框，选中后设为当前打开的文件夹（未选择则不动） */
export async function openFolderDialog(): Promise<void> {
  const selected = await open({
    directory: true,
    multiple: false,
  })

  if (selected && typeof selected === 'string') {
    useEditorStore.getState().setOpenedFolder(selected)
  }
}
