import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useEditorStore,
  type RecentFile,
} from '../../stores/editorStore'
import { openFileByPath } from '../../lib/fileOps'
import { confirmDialog } from '../../lib/dialog'
import { revealInFolder } from '../../lib/fileTreeUtils'
import { writeClipboardText } from '../../lib/clipboard'
import { isMacOS } from '../../lib/platform'
import { isTauri } from '../../lib/imageSrc'
import { useContextMenu } from '../../hooks/useContextMenu'
import { ContextMenu, type MenuItem } from '../Menu'
import {
  buildOutlineTree,
  extractOutline,
  findActiveOutlineItem,
  type OutlineItem,
} from '../../lib/outlineUtils'
import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { FileTree } from '../FileTree'
import { OutlineTree } from './OutlineTree'
import { useResizable } from '../../hooks/useResizable'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export function Sidebar() {
  const { t } = useTranslation()
  const {
    showSidebar,
    content,
    recentFiles,
    isDirty,
    clearRecentFiles,
    sidebarTab,
    setSidebarTab,
    sidebarWidth,
    setSidebarWidth,
    openedFolder,
    setOpenedFolder,
    cursorLine,
    viewMode,
    activeHeadingIndex,
  } = useEditorStore()

  // 最近文件过滤关键字（本地状态）
  const [recentFilter, setRecentFilter] = useState('')

  // 最近文件右键菜单（打开/复制路径/在 Finder 中显示/从列表移除）
  const {
    menu: recentMenu,
    openMenu: openRecentMenu,
    closeMenu: closeRecentMenu,
  } = useContextMenu<RecentFile>()
  const removeRecentFile = useEditorStore((state) => state.removeRecentFile)

  const recentMenuItems = useMemo<MenuItem[]>(
    () => [
      { id: 'open', label: t('fileTree.open') },
      { id: 'copy-path', label: t('fileTree.copyPath') },
      {
        id: 'reveal',
        label: t(isMacOS() ? 'fileTree.revealFinder' : 'fileTree.revealFileManager'),
      },
      { divider: true },
      { id: 'remove', label: t('sidebar.removeFromRecent') },
    ],
    [t]
  )

  // 大纲折叠状态：存已折叠项的 OutlineItem.index，默认全展开；
  // 内容变化（防抖后）时集合自然保留，index 漂移可接受，不做过期清理
  const [collapsedSet, setCollapsedSet] = useState<ReadonlySet<number>>(new Set())

  const toggleCollapsed = useCallback((index: number) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // 可拖拽调整宽度，拖动时实时写回 store 持久化
  const handleResize = useCallback((w: number) => setSidebarWidth(w), [setSidebarWidth])
  const { width, isResizing, handleMouseDown } = useResizable({
    initialWidth: sidebarWidth,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    onResize: handleResize,
  })

  // 大纲使用 200ms 防抖后的内容，避免每次按键全量重算
  const debouncedContent = useDebouncedValue(content, 200)

  // 提取大纲（使用工具函数）
  const headings = useMemo(() => extractOutline(debouncedContent), [debouncedContent])

  // 平铺大纲 → 层级树（同级连续项归组，深层项嵌进最近的上级）
  const outlineTree = useMemo(() => buildOutlineTree(headings), [headings])

  // 当前位置高亮：source/split 按 cursorLine 推导「最后一个 lineIndex+1 <= cursorLine 的标题」；
  // wysiwyg 用 WysiwygEditor 上报的 activeHeadingIndex；preview 不高亮
  const activeOutlineIndex = useMemo(() => {
    if (viewMode === 'source' || viewMode === 'split') {
      return findActiveOutlineItem(headings, cursorLine)?.index ?? null
    }
    if (viewMode === 'wysiwyg') return activeHeadingIndex
    return null
  }, [viewMode, headings, cursorLine, activeHeadingIndex])

  // 高亮项变化时滚动到大纲可视区域（nearest：已可见则不滚动）
  const activeItemRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeOutlineIndex])

  // 按 name/path 子串过滤最近文件（大小写不敏感）
  const filteredRecentFiles = useMemo(() => {
    const query = recentFilter.trim().toLowerCase()
    if (!query) return recentFiles
    return recentFiles.filter(
      (file) => file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)
    )
  }, [recentFiles, recentFilter])

  const handleRecentFileClick = useCallback(
    async (file: RecentFile) => {
      // 桌面端多窗口路由：已打开→聚焦 / 本窗口干净空文档→复用 / 否则新建窗口
      if (isTauri()) {
        await invoke('route_open', { paths: [file.path] })
        return
      }
      if (isDirty) {
        if (!(await confirmDialog(t('dialog.confirmDiscard')))) {
          return
        }
      }
      await openFileByPath(file.path)
    },
    [isDirty, t]
  )

  const handleRecentMenuSelect = useCallback(
    (id: string) => {
      const file = recentMenu?.data
      if (!file) return
      switch (id) {
        case 'open':
          void handleRecentFileClick(file)
          break
        case 'copy-path':
          void writeClipboardText(file.path)
          break
        case 'reveal':
          void revealInFolder(file.path).catch(() => {})
          break
        case 'remove':
          removeRecentFile(file.path)
          break
      }
    },
    [recentMenu, removeRecentFile, handleRecentFileClick]
  )

  // 打开文件夹（与 FileTree 未打开状态的入口一致）
  const handleOpenFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    })

    if (selected && typeof selected === 'string') {
      setOpenedFolder(selected)
    }
  }, [setOpenedFolder])

  // 点击大纲项 - 派发事件通知 Editor 滚动
  const handleHeadingClick = useCallback((heading: OutlineItem) => {
    window.dispatchEvent(
      new CustomEvent('editor-scroll-to-heading', {
        detail: {
          charIndex: heading.charIndex,
          lineIndex: heading.lineIndex,
          index: heading.index,
        },
      })
    )
  }, [])

  if (!showSidebar) return null

  return (
    <div
      className="border-r border-[var(--editor-border)] bg-[var(--sidebar-bg)] flex flex-col relative"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {/* 标签页切换 */}
      <div className="flex border-b border-[var(--editor-border)]">
        <button
          onClick={() => setSidebarTab('files')}
          className={`
            flex-1 px-3 py-2.5 text-xs font-medium transition-colors duration-150
            ${
              sidebarTab === 'files'
                ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }
          `}
        >
          {t('sidebar.files')}
        </button>
        <button
          onClick={() => setSidebarTab('outline')}
          className={`
            flex-1 px-3 py-2.5 text-xs font-medium transition-colors duration-150
            ${
              sidebarTab === 'outline'
                ? 'text-[var(--accent-color)] border-b-2 border-[var(--accent-color)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
            }
          `}
        >
          {t('sidebar.outline')}
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {sidebarTab === 'outline' ? (
          // 大纲视图
          <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden">
            {headings.length === 0 ? (
              <div className="text-sm text-[var(--color-text-muted)] italic">
                {t('sidebar.noHeadings')}
              </div>
            ) : (
              <OutlineTree
                nodes={outlineTree}
                collapsedSet={collapsedSet}
                activeIndex={activeOutlineIndex}
                onToggle={toggleCollapsed}
                onHeadingClick={handleHeadingClick}
                activeItemRef={activeItemRef}
              />
            )}
          </div>
        ) : openedFolder ? (
          // 文件视图（已打开文件夹）：文件树头部与关闭按钮由 FileTree 自身渲染
          <FileTree />
        ) : (
          // 文件视图（未打开文件夹）：打开文件夹入口 + 最近文件
          <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden">
            <button
              onClick={handleOpenFolder}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-4
                text-sm font-medium text-white bg-[var(--accent-color)] rounded-md
                hover:opacity-90 active:opacity-80 transition-opacity duration-150"
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

            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                {t('sidebar.recentFiles')}
              </h3>
              {recentFiles.length > 0 && (
                <button
                  onClick={clearRecentFiles}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  title={t('sidebar.clearTooltip')}
                >
                  {t('sidebar.clear')}
                </button>
              )}
            </div>

            {recentFiles.length > 0 && (
              <div className="relative mb-2">
                <svg
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.1 5.1a7.5 7.5 0 0011.55 11.55z"
                  />
                </svg>
                <input
                  type="text"
                  value={recentFilter}
                  onChange={(e) => setRecentFilter(e.target.value)}
                  placeholder={t('sidebar.filterRecent')}
                  className="w-full pl-7 pr-2 py-1.5 text-sm bg-[var(--editor-bg)]
                    text-[var(--color-text)] border border-[var(--editor-border)] rounded-md
                    outline-none focus:border-[var(--accent-color)]"
                />
              </div>
            )}

            {filteredRecentFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[var(--color-text-muted)]">
                <svg
                  className="w-8 h-8 mb-2 opacity-40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="text-sm">{t('sidebar.noRecentFiles')}</div>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {filteredRecentFiles.map((file) => (
                  <li
                    key={file.path}
                    onClick={() => handleRecentFileClick(file)}
                    onContextMenu={(e) => openRecentMenu(e, file)}
                    className="text-sm text-[var(--color-text)] hover:bg-[var(--hover-bg)] cursor-pointer rounded-md px-2 py-1.5 flex items-center gap-1.5 transition-colors duration-100"
                    title={file.path}
                  >
                    <svg
                      className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="truncate">{file.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 最近文件右键菜单 */}
      {recentMenu && (
        <ContextMenu
          x={recentMenu.x}
          y={recentMenu.y}
          items={recentMenuItems}
          onSelect={handleRecentMenuSelect}
          onClose={closeRecentMenu}
        />
      )}

      {/* 拖拽调整宽度的 handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          absolute right-0 top-0 bottom-0 w-1 cursor-col-resize
          hover:bg-[var(--accent-color)] hover:opacity-50
          ${isResizing ? 'bg-[var(--accent-color)] opacity-50' : 'bg-transparent'}
        `}
        title={t('sidebar.dragToResize')}
      />
    </div>
  )
}
