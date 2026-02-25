import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { useEditorStore } from '../stores/editorStore'

interface FileInfo {
  path: string
  content: string
  name: string
}

interface SaveResult {
  success: boolean
  error: string | null
}

// 打开文件
export async function openFile(): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (selected && typeof selected === 'string') {
    await openFileByPath(selected)
  }
}

// 保存文件
export async function saveFile(): Promise<boolean> {
  const store = useEditorStore.getState()
  const { content, filePath } = store

  if (!filePath) {
    return saveFileAs()
  }

  const result = await invoke<SaveResult>('save_file', {
    path: filePath,
    content,
  })

  if (result.success) {
    store.setDirty(false)
    return true
  }

  console.error('Save failed:', result.error)
  return false
}

// 另存为
export async function saveFileAs(): Promise<boolean> {
  const store = useEditorStore.getState()
  const { content, fileName } = store

  const selected = await save({
    defaultPath: fileName,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Text', extensions: ['txt'] },
    ],
  })

  if (selected && typeof selected === 'string') {
    const result = await invoke<SaveResult>('save_file', {
      path: selected,
      content,
    })

    if (result.success) {
      const path = selected
      const name = path.split('/').pop() || fileName

      store.setFilePath(path)
      store.setFileName(name)
      store.setDirty(false)
      return true
    }

    console.error('Save failed:', result.error)
  }

  return false
}

// 新建文件
export function newFile(): void {
  const store = useEditorStore.getState()
  store.resetDocument()
}

// 通过路径打开文件 (用于拖放打开和最近文件)
export async function openFileByPath(path: string): Promise<boolean> {
  try {
    const fileInfo = await invoke<FileInfo>('read_file', { path })
    const store = useEditorStore.getState()

    store.setContent(fileInfo.content)
    store.setFilePath(fileInfo.path)
    store.setFileName(fileInfo.name)
    store.setDirty(false)
    // 添加到最近文件列表
    store.addRecentFile(fileInfo.path, fileInfo.name)
    return true
  } catch (error) {
    console.error('Failed to open file:', error)
    return false
  }
}
