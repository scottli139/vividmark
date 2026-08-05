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
 * 创建空文件（已存在时后端报错，错误串直接 reject）
 */
export async function createFile(path: string): Promise<void> {
  fileOpsLogger.debug('Creating file:', { path })

  try {
    await invoke('create_file', { path })
    fileOpsLogger.info('File created:', { path })
  } catch (error) {
    fileOpsLogger.error('Failed to create file:', error)
    throw error
  }
}

/**
 * 创建文件夹（已存在时后端报错，错误串直接 reject）
 */
export async function createFolder(path: string): Promise<void> {
  fileOpsLogger.debug('Creating folder:', { path })

  try {
    await invoke('create_folder', { path })
    fileOpsLogger.info('Folder created:', { path })
  } catch (error) {
    fileOpsLogger.error('Failed to create folder:', error)
    throw error
  }
}

/**
 * 重命名/移动文件或文件夹（源不存在或目标已存在时后端报错）
 */
export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  fileOpsLogger.debug('Renaming path:', { oldPath, newPath })

  try {
    await invoke('rename_path', { oldPath, newPath })
    fileOpsLogger.info('Path renamed:', { oldPath, newPath })
  } catch (error) {
    fileOpsLogger.error('Failed to rename path:', error)
    throw error
  }
}

/**
 * 删除文件或文件夹（文件夹级联删除；确认由前端完成）
 */
export async function deletePath(path: string): Promise<void> {
  fileOpsLogger.debug('Deleting path:', { path })

  try {
    await invoke('delete_path', { path })
    fileOpsLogger.info('Path deleted:', { path })
  } catch (error) {
    fileOpsLogger.error('Failed to delete path:', error)
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
 * 按查询串过滤文件树：名称大小写不敏感子串匹配。
 * 命中项整棵子树保留；未命中目录若后代命中则保留祖先链；空 query 原样返回。
 */
export function filterTreeByQuery(items: FileTreeItem[], query: string): FileTreeItem[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return items

  const walk = (list: FileTreeItem[]): FileTreeItem[] =>
    list.reduce<FileTreeItem[]>((acc, item) => {
      if (item.name.toLowerCase().includes(normalized)) {
        acc.push(item)
        return acc
      }
      if (item.children) {
        const children = walk(item.children)
        if (children.length > 0) {
          acc.push({ ...item, children })
        }
      }
      return acc
    }, [])

  return walk(items)
}

/**
 * 默认展开策略：仅展开第一层目录，其余目录折叠
 */
export function expandFirstLevel(items: FileTreeItem[]): FileTreeItem[] {
  const walk = (list: FileTreeItem[], depth: number): FileTreeItem[] =>
    list.map((item) => ({
      ...item,
      isExpanded: item.isDirectory ? depth === 0 : undefined,
      children: item.children ? walk(item.children, depth + 1) : undefined,
    }))

  return walk(items, 0)
}

/**
 * 递归设置所有目录的展开状态（过滤搜索时临时全展开用）
 */
export function setAllExpanded(items: FileTreeItem[], expanded: boolean): FileTreeItem[] {
  return items.map((item) => ({
    ...item,
    isExpanded: item.isDirectory ? expanded : undefined,
    children: item.children ? setAllExpanded(item.children, expanded) : undefined,
  }))
}

/**
 * 收集树中所有已展开目录的路径（刷新后恢复展开状态用）
 */
export function collectExpandedPaths(items: FileTreeItem[]): Set<string> {
  const paths = new Set<string>()

  const walk = (list: FileTreeItem[]) => {
    for (const item of list) {
      if (item.isDirectory && item.isExpanded) {
        paths.add(item.path)
      }
      if (item.children) {
        walk(item.children)
      }
    }
  }

  walk(items)
  return paths
}

/**
 * 按路径集合恢复目录展开状态（不在集合中的目录一律折叠）
 */
export function applyExpandedPaths(
  items: FileTreeItem[],
  expandedPaths: Set<string>
): FileTreeItem[] {
  return items.map((item) => ({
    ...item,
    isExpanded: item.isDirectory ? expandedPaths.has(item.path) : undefined,
    children: item.children ? applyExpandedPaths(item.children, expandedPaths) : undefined,
  }))
}

/**
 * 获取路径的父目录（统一 `\` → `/`；根级路径返回 null）
 */
export function getParentPath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash > 0 ? normalized.slice(0, lastSlash) : null
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
