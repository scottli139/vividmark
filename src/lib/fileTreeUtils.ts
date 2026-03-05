import { invoke } from '@tauri-apps/api/core'
import { fileOpsLogger } from './logger'

/**
 * 文件树项
 */
export interface FileTreeItem {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeItem[]
  isExpanded?: boolean
}

/**
 * 读取目录参数
 */
export interface ReadDirectoryParams {
  path: string
  recursive?: boolean
}

/**
 * 读取目录内容
 */
export async function readDirectory(path: string, recursive = false): Promise<FileTreeItem[]> {
  fileOpsLogger.debug('Reading directory:', { path, recursive })

  try {
    const items = await invoke<FileTreeItem[]>('read_directory', {
      params: { path, recursive },
    })

    fileOpsLogger.info('Directory read successfully:', {
      path,
      count: items.length,
    })

    return items
  } catch (error) {
    fileOpsLogger.error('Failed to read directory:', error)
    throw error
  }
}

/**
 * 展开/折叠文件夹
 */
export function toggleFolder(items: FileTreeItem[], targetPath: string): FileTreeItem[] {
  return items.map((item) => {
    if (item.path === targetPath) {
      return { ...item, isExpanded: !item.isExpanded }
    }
    if (item.children) {
      return { ...item, children: toggleFolder(item.children, targetPath) }
    }
    return item
  })
}

/**
 * 查找文件树中的项
 */
export function findTreeItem(items: FileTreeItem[], path: string): FileTreeItem | undefined {
  for (const item of items) {
    if (item.path === path) {
      return item
    }
    if (item.children) {
      const found = findTreeItem(item.children, path)
      if (found) return found
    }
  }
  return undefined
}

/**
 * 展开指定路径的所有父文件夹
 */
export function expandParentPaths(items: FileTreeItem[], targetPath: string): FileTreeItem[] {
  return items.map((item) => {
    if (targetPath.startsWith(item.path + '/') || targetPath === item.path) {
      const newItem = { ...item, isExpanded: true }
      if (item.children && targetPath !== item.path) {
        newItem.children = expandParentPaths(item.children, targetPath)
      }
      return newItem
    }
    return item
  })
}

/**
 * 更新文件树中的某一项（用于懒加载子目录）
 */
export function updateTreeItem(
  items: FileTreeItem[],
  targetPath: string,
  updates: Partial<FileTreeItem>
): FileTreeItem[] {
  return items.map((item) => {
    if (item.path === targetPath) {
      return { ...item, ...updates }
    }
    if (item.children) {
      return { ...item, children: updateTreeItem(item.children, targetPath, updates) }
    }
    return item
  })
}

/**
 * 过滤文件树（只显示 Markdown 文件和文件夹）
 */
export function filterMarkdownFiles(items: FileTreeItem[]): FileTreeItem[] {
  return items
    .filter((item) => {
      if (item.isDirectory) return true
      return (
        item.name.endsWith('.md') || item.name.endsWith('.markdown') || item.name.endsWith('.txt')
      )
    })
    .map((item) => {
      if (item.children) {
        return { ...item, children: filterMarkdownFiles(item.children) }
      }
      return item
    })
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : ''
}

/**
 * 获取文件图标类型
 */
export function getFileIconType(item: FileTreeItem): string {
  if (item.isDirectory) {
    return item.isExpanded ? 'folder-open' : 'folder'
  }

  const ext = getFileExtension(item.name)
  const iconMap: Record<string, string> = {
    md: 'markdown',
    markdown: 'markdown',
    txt: 'text',
    js: 'code',
    ts: 'code',
    jsx: 'code',
    tsx: 'code',
    json: 'json',
    yml: 'yaml',
    yaml: 'yaml',
    css: 'style',
    scss: 'style',
    html: 'html',
    svg: 'image',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    pdf: 'pdf',
  }

  return iconMap[ext] || 'file'
}
