import { useState, useCallback, useEffect, useMemo } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import type { FileTreeItem } from '../../lib/fileTreeUtils'
import {
  readDirectory,
  toggleFolder,
  filterMarkdownFiles,
  filterTreeByQuery,
  expandFirstLevel,
  setAllExpanded,
  collectExpandedPaths,
  applyExpandedPaths,
  expandParentPaths,
  findTreeItem,
  updateTreeItem,
  getParentPath,
  createFile,
  createFolder,
  renamePath,
  deletePath,
  copyPath,
  revealInFolder,
  pathExists,
  copyNameCandidate,
} from '../../lib/fileTreeUtils'
import { openFileByPath } from '../../lib/fileOps'
import { writeClipboardText } from '../../lib/clipboard'
import { isMacOS } from '../../lib/platform'
import { confirmDialog, alertDialog } from '../../lib/dialog'
import { useEditorStore } from '../../stores/editorStore'
import { ContextMenu, type MenuItem } from '../Menu'
import { FileTreeItem as FileTreeItemComponent } from './FileTreeItem'
import type { CreatingState } from './FileTreeItem'
import { InlineNameInput } from './InlineNameInput'

interface FileTreeProps {
  showMarkdownOnly?: boolean
}

interface ContextMenuState {
  x: number
  y: number
  /** 右键目标项；null = 空白区（作用于根目录） */
  target: FileTreeItem | null
}

/** 提取 invoke 抛出的错误串（Tauri 后端直接 reject 英文错误串） */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function FileTree({ showMarkdownOnly = true }: FileTreeProps) {
  const { t } = useTranslation()
  const { openedFolder, setOpenedFolder, filePath, isDirty } = useEditorStore()

  const [items, setItems] = useState<FileTreeItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [creating, setCreating] = useState<CreatingState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // 加载目录内容；restore 提供时按其恢复展开状态，否则默认只展开第一层
  const loadDirectory = useCallback(
    async (path: string, options?: { restore?: Set<string>; reveal?: string }) => {
      setIsLoading(true)
      setError(null)

      try {
        const directoryItems = await readDirectory(path, true)
        let next = showMarkdownOnly ? filterMarkdownFiles(directoryItems) : directoryItems
        next = options?.restore ? applyExpandedPaths(next, options.restore) : expandFirstLevel(next)
        // 定位目标路径（默认当前打开文件）：展开其父链
        const reveal = options?.reveal ?? useEditorStore.getState().filePath
        if (reveal && findTreeItem(next, reveal)) {
          next = expandParentPaths(next, reveal)
        }
        setItems(next)
      } catch (err) {
        setError(errorMessage(err))
        setItems([])
      } finally {
        setIsLoading(false)
      }
    },
    [showMarkdownOnly]
  )

  // 当 openedFolder 变化时加载目录
  useEffect(() => {
    if (openedFolder) {
      loadDirectory(openedFolder)
    } else {
      setItems([])
    }
  }, [openedFolder, loadDirectory])

  // 文件操作后刷新：收集当前展开路径集合，刷新后按路径恢复；revealPath 展开父链定位
  const refreshTree = useCallback(
    async (revealPath?: string) => {
      if (!openedFolder) return
      await loadDirectory(openedFolder, {
        restore: collectExpandedPaths(items),
        reveal: revealPath,
      })
    },
    [openedFolder, items, loadDirectory]
  )

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
        if (!(await confirmDialog(t('dialog.confirmDiscard')))) {
          return
        }
      }

      await openFileByPath(item.path)
    },
    [isDirty, t]
  )

  // 过滤输入：退出进行中的行内编辑，避免输入行被过滤掉
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setEditingPath(null)
    setCreating(null)
  }, [])

  // 在目标文件夹内开始新建：追加临时输入行，确保目标展开并退出过滤
  const startCreating = useCallback((parentPath: string, kind: 'file' | 'folder') => {
    setQuery('')
    setEditingPath(null)
    setCreating({ parentPath, kind })
    setItems((prevItems) => updateTreeItem(prevItems, parentPath, { isExpanded: true }))
  }, [])

  // 删除（目录提示级联删除）
  const handleDelete = useCallback(
    async (item: FileTreeItem) => {
      const confirmed = await confirmDialog(
        item.isDirectory
          ? t('fileTree.confirmDeleteFolder', { name: item.name })
          : t('fileTree.confirmDeleteFile', { name: item.name })
      )
      if (!confirmed) return

      try {
        await deletePath(item.path)
      } catch (err) {
        await alertDialog(errorMessage(err))
        return
      }
      await refreshTree()
    },
    [t, refreshTree]
  )

  // 创建副本：`a.md` → `a copy.md`（重名递增 ` copy N`），与目标同目录
  const handleDuplicate = useCallback(
    async (item: FileTreeItem) => {
      const parentPath = getParentPath(item.path)
      for (let n = 1; n < 100; n++) {
        const candidate = `${parentPath}/${copyNameCandidate(item.name, item.isDirectory, n)}`
        try {
          if (!(await pathExists(candidate))) {
            await copyPath(item.path, candidate)
            await refreshTree(candidate)
            return
          }
        } catch (err) {
          await alertDialog(errorMessage(err))
          return
        }
      }
      await alertDialog(t('fileTree.duplicateFailed', { name: item.name }))
    },
    [refreshTree, t]
  )

  // 右键菜单
  const handleItemContextMenu = useCallback((item: FileTreeItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, target: item })
  }, [])

  const handleBlankContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, target: null })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const contextMenuItems = useMemo<MenuItem[]>(() => {
    if (!contextMenu) return []
    const revealLabel = t(isMacOS() ? 'fileTree.revealFinder' : 'fileTree.revealFileManager')
    if (contextMenu.target) {
      const target = contextMenu.target
      // 结构对齐 Typora：打开 — 新建 — 副本/重命名 — 删除 — 路径/访达
      return [
        ...(!target.isDirectory
          ? ([{ id: 'open', label: t('fileTree.open') }, { divider: true }] as MenuItem[])
          : []),
        { id: 'new-file', label: t('fileTree.newFile') },
        { id: 'new-folder', label: t('fileTree.newFolder') },
        { divider: true },
        { id: 'duplicate', label: t('fileTree.duplicate') },
        { id: 'rename', label: t('fileTree.rename') },
        { divider: true },
        { id: 'delete', label: t('fileTree.delete') },
        { divider: true },
        { id: 'copy-path', label: t('fileTree.copyPath') },
        { id: 'reveal', label: revealLabel },
      ]
    }
    return [
      { id: 'new-file', label: t('fileTree.newFile') },
      { id: 'new-folder', label: t('fileTree.newFolder') },
      { id: 'open-folder', label: t('fileTree.openFolder') },
      { divider: true },
      { id: 'reveal', label: revealLabel },
    ]
  }, [contextMenu, t])

  const handleMenuSelect = useCallback(
    (id: string) => {
      const target = contextMenu?.target ?? null

      switch (id) {
        case 'new-file':
        case 'new-folder': {
          const parentPath = target
            ? target.isDirectory
              ? target.path
              : getParentPath(target.path)
            : openedFolder
          if (parentPath) {
            startCreating(parentPath, id === 'new-file' ? 'file' : 'folder')
          }
          break
        }
        case 'open':
          if (target) void handleSelect(target)
          break
        case 'rename':
          if (target) {
            setCreating(null)
            setEditingPath(target.path)
          }
          break
        case 'duplicate':
          if (target) void handleDuplicate(target)
          break
        case 'delete':
          if (target) {
            void handleDelete(target)
          }
          break
        case 'copy-path':
          if (target) void writeClipboardText(target.path)
          break
        case 'reveal': {
          const path = target?.path ?? openedFolder
          if (path) void revealInFolder(path).catch((err) => alertDialog(errorMessage(err)))
          break
        }
        case 'open-folder':
          void handleOpenFolder()
          break
      }
    },
    [
      contextMenu,
      openedFolder,
      startCreating,
      handleSelect,
      handleDuplicate,
      handleDelete,
      handleOpenFolder,
    ]
  )

  // 重命名提交：同步 store（当前打开文件）并刷新定位
  const handleRenameSubmit = useCallback(
    async (item: FileTreeItem, newName: string) => {
      setEditingPath(null)

      const trimmed = newName.trim()
      if (!trimmed || trimmed === item.name) return

      const parentPath = getParentPath(item.path)
      const newPath = parentPath ? `${parentPath}/${trimmed}` : trimmed

      try {
        await renamePath(item.path, newPath)
      } catch (err) {
        await alertDialog(errorMessage(err))
        return
      }

      // 重命名当前打开文件时同步 store（含最近文件条目）
      const state = useEditorStore.getState()
      if (state.filePath === item.path) {
        state.setFilePath(newPath)
        state.setFileName(trimmed)
        state.renameRecentFile(item.path, newPath, trimmed)
      }

      await refreshTree(newPath)
    },
    [refreshTree]
  )

  const handleRenameCancel = useCallback(() => setEditingPath(null), [])

  // 新建提交
  const handleCreateSubmit = useCallback(
    async (name: string) => {
      const current = creating
      setCreating(null)
      if (!current) return

      const trimmed = name.trim()
      if (!trimmed) return

      const newPath = `${current.parentPath}/${trimmed}`

      try {
        if (current.kind === 'file') {
          await createFile(newPath)
        } else {
          await createFolder(newPath)
        }
      } catch (err) {
        await alertDialog(errorMessage(err))
        return
      }

      await refreshTree(newPath)
    },
    [creating, refreshTree]
  )

  const handleCreateCancel = useCallback(() => setCreating(null), [])

  // 过滤时命中结果临时全部展开（不改动原始展开状态，清空即恢复）
  const visibleItems = useMemo(() => {
    if (!query.trim()) return items
    return setAllExpanded(filterTreeByQuery(items, query), true)
  }, [items, query])

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
          className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider truncate flex-1"
          title={openedFolder ?? undefined}
        >
          {folderName}
        </span>
        <button
          onClick={handleCloseFolder}
          className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]
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

      {/* 过滤输入框 */}
      <div className="px-2 py-1.5 border-b border-[var(--editor-border)]">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={t('fileTree.filterPlaceholder')}
          className="w-full px-2 py-1 text-sm bg-[var(--editor-bg)]
            text-[var(--color-text)] border border-[var(--editor-border)] rounded
            outline-none focus:border-[var(--accent-color)]"
        />
      </div>

      {/* 文件树内容 */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onContextMenu={handleBlankContextMenu}
      >
        {isLoading ? (
          <div className="p-4 text-center text-sm text-[var(--color-text-secondary)]">
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
        ) : visibleItems.length === 0 && !creating ? (
          <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">
            {t(query.trim() ? 'fileTree.noMatches' : 'fileTree.emptyFolder')}
          </div>
        ) : (
          <div className="py-1">
            {visibleItems.map((item) => (
              <FileTreeItemComponent
                key={item.path}
                item={item}
                level={0}
                selectedPath={filePath}
                editingPath={editingPath}
                creating={creating}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onContextMenu={handleItemContextMenu}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
                onCreateSubmit={handleCreateSubmit}
                onCreateCancel={handleCreateCancel}
              />
            ))}
            {/* 根目录新建的临时输入行 */}
            {creating && creating.parentPath === openedFolder && (
              <InlineNameInput
                level={0}
                isDirectory={creating.kind === 'folder'}
                onSubmit={handleCreateSubmit}
                onCancel={handleCreateCancel}
              />
            )}
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onSelect={handleMenuSelect}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}
