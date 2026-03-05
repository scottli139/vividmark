import { useState, useCallback, useEffect, useMemo } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import type { FileTreeItem } from '../../lib/fileTreeUtils'
import { readDirectory, toggleFolder, filterMarkdownFiles } from '../../lib/fileTreeUtils'
import { openFileByPath } from '../../lib/fileOps'
import { useEditorStore } from '../../stores/editorStore'
import { FileTreeItem as FileTreeItemComponent } from './FileTreeItem'

interface FileTreeProps {
  showMarkdownOnly?: boolean
}

export function FileTree({ showMarkdownOnly = true }: FileTreeProps) {
  const { t } = useTranslation()
  const { openedFolder, setOpenedFolder, filePath, isDirty } = useEditorStore()

  const [items, setItems] = useState<FileTreeItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 递归设置所有文件夹的展开状态
  const setAllExpanded = useCallback((items: FileTreeItem[], expanded: boolean): FileTreeItem[] => {
    return items.map((item) => ({
      ...item,
      isExpanded: item.isDirectory ? expanded : undefined,
      children: item.children ? setAllExpanded(item.children, expanded) : undefined,
    }))
  }, [])

  // 加载目录内容
  const loadDirectory = useCallback(
    async (path: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const directoryItems = await readDirectory(path, true)
        // 递归展开所有文件夹
        const itemsWithExpansion = setAllExpanded(directoryItems, true)
        setItems(showMarkdownOnly ? filterMarkdownFiles(itemsWithExpansion) : itemsWithExpansion)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setItems([])
      } finally {
        setIsLoading(false)
      }
    },
    [showMarkdownOnly, setAllExpanded]
  )

  // 当 openedFolder 变化时加载目录
  useEffect(() => {
    if (openedFolder) {
      loadDirectory(openedFolder)
    } else {
      setItems([])
    }
  }, [openedFolder, loadDirectory])

  // 打开文件夹对话框
  const handleOpenFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    })

    if (selected && typeof selected === 'string') {
      setOpenedFolder(selected)
    }
  }, [setOpenedFolder])

  // 关闭文件夹
  const handleCloseFolder = useCallback(() => {
    setOpenedFolder(null)
  }, [setOpenedFolder])

  // 切换文件夹展开/折叠
  const handleToggle = useCallback((item: FileTreeItem) => {
    setItems((prevItems) => toggleFolder(prevItems, item.path))
  }, [])

  // 选择文件
  const handleSelect = useCallback(
    async (item: FileTreeItem) => {
      if (item.isDirectory) return

      // 检查是否有未保存的更改
      if (isDirty) {
        if (!confirm(t('dialog.confirmDiscard'))) {
          return
        }
      }

      await openFileByPath(item.path)
    },
    [isDirty, t]
  )

  // 获取文件夹名称
  const folderName = useMemo(() => {
    if (!openedFolder) return null
    const parts = openedFolder.split(/[\\/]/)
    return parts[parts.length - 1] || openedFolder
  }, [openedFolder])

  // 如果没有打开的文件夹，显示提示
  if (!openedFolder) {
    return (
      <div className="p-3">
        <button
          onClick={handleOpenFolder}
          className="w-full flex items-center justify-center gap-2 px-3 py-2
            text-sm font-medium text-[var(--accent-color)]
            border border-[var(--accent-color)] rounded
            hover:bg-[var(--accent-color)] hover:text-white
            transition-colors duration-150"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          {t('fileTree.openFolder')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 文件夹标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--editor-border)]">
        <span
          className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate flex-1"
          title={openedFolder ?? undefined}
        >
          {folderName}
        </span>
        <button
          onClick={handleCloseFolder}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
            rounded transition-colors duration-150"
          title={t('fileTree.closeFolder')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 文件树内容 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500">
            <svg
              className="w-5 h-5 mx-auto mb-2 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {t('fileTree.loading')}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-red-500">
            <svg
              className="w-5 h-5 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">{t('fileTree.emptyFolder')}</div>
        ) : (
          <div className="py-1">
            {items.map((item) => (
              <FileTreeItemComponent
                key={item.path}
                item={item}
                level={0}
                selectedPath={filePath}
                onToggle={handleToggle}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
