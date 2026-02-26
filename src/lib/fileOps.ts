import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import i18n from '../i18n'
import { useEditorStore } from '../stores/editorStore'
import { fileOpsLogger } from './logger'
import { preprocessImages } from './markdown/parser'

// 获取当前语言的翻译
function t(key: string): string {
  return i18n.t(key) as string
}

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
      { name: t('file.filters.markdown'), extensions: ['md', 'markdown', 'txt'] },
      { name: t('file.filters.allFiles'), extensions: ['*'] },
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

  fileOpsLogger.time('save')
  fileOpsLogger.debug('Saving file:', { path: filePath, size: content.length })

  const result = await invoke<SaveResult>('save_file', {
    path: filePath,
    content,
  })

  if (result.success) {
    fileOpsLogger.timeEnd('save')
    fileOpsLogger.info('File saved:', { path: filePath })
    store.setDirty(false)
    return true
  }

  fileOpsLogger.error('Save failed:', result.error)
  return false
}

// 另存为
export async function saveFileAs(): Promise<boolean> {
  const store = useEditorStore.getState()
  const { content, fileName } = store

  const selected = await save({
    defaultPath: fileName,
    filters: [
      { name: t('file.filters.markdown'), extensions: ['md'] },
      { name: t('file.filters.text'), extensions: ['txt'] },
    ],
  })

  if (selected && typeof selected === 'string') {
    fileOpsLogger.debug('Save as:', { path: selected })

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
      fileOpsLogger.info('File saved as:', { path })
      return true
    }

    fileOpsLogger.error('Save as failed:', result.error)
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
  fileOpsLogger.time('open')
  fileOpsLogger.debug('Opening file:', { path })

  try {
    const fileInfo = await invoke<FileInfo>('read_file', { path })
    const store = useEditorStore.getState()

    // 获取文件所在目录，用于解析相对路径图片
    const fileDir = path.substring(0, path.lastIndexOf('/'))

    // 预处理图片（将本地图片转换为 base64）
    fileOpsLogger.debug('Preprocessing images...', { baseDir: fileDir })
    const processedContent = await preprocessImages(fileInfo.content, fileDir)

    store.setContent(processedContent)
    store.setFilePath(fileInfo.path)
    store.setFileName(fileInfo.name)
    store.setDirty(false)
    // 添加到最近文件列表
    store.addRecentFile(fileInfo.path, fileInfo.name)

    fileOpsLogger.timeEnd('open')
    fileOpsLogger.info('File opened:', {
      path: fileInfo.path,
      name: fileInfo.name,
      size: fileInfo.content.length,
    })
    return true
  } catch (error) {
    fileOpsLogger.error('Failed to open file:', error)
    return false
  }
}
