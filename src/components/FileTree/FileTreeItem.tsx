import { memo, useCallback } from 'react'
import type { FileTreeItem as FileTreeItemType } from '../../lib/fileTreeUtils'
import { getFileIconType } from '../../lib/fileTreeUtils'

interface FileTreeItemProps {
  item: FileTreeItemType
  level: number
  selectedPath: string | null
  onToggle: (item: FileTreeItemType) => void
  onSelect: (item: FileTreeItemType) => void
}

/**
 * 文件图标组件
 */
function FileIcon({ type, isSelected }: { type: string; isSelected: boolean }) {
  const iconColor = isSelected ? 'currentColor' : 'currentColor'

  switch (type) {
    case 'folder':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke={iconColor}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
          />
        </svg>
      )
    case 'folder-open':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke={iconColor}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V5A2.25 2.25 0 016 2.25h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
          />
        </svg>
      )
    case 'markdown':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke={iconColor}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      )
    case 'code':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke={iconColor}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
          />
        </svg>
      )
    case 'image':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke={iconColor}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      )
    case 'json':
    case 'yaml':
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke={iconColor}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
          />
        </svg>
      )
    default:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke={iconColor}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      )
  }
}

/**
 * 展开/折叠指示器
 */
function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export const FileTreeItem = memo(function FileTreeItem({
  item,
  level,
  selectedPath,
  onToggle,
  onSelect,
}: FileTreeItemProps) {
  const isSelected = selectedPath === item.path
  const iconType = getFileIconType(item)

  const handleClick = useCallback(() => {
    if (item.isDirectory) {
      onToggle(item)
    } else {
      onSelect(item)
    }
  }, [item, onToggle, onSelect])

  const handleToggleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggle(item)
    },
    [item, onToggle]
  )

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={`
          flex items-center gap-1 px-2 py-1 cursor-pointer text-sm
          transition-colors duration-150
          ${
            isSelected
              ? 'bg-[var(--accent-color)] text-white'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
          }
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        title={item.path}
      >
        {/* 展开/折叠指示器 */}
        <span
          onClick={handleToggleClick}
          className={`
            w-4 h-4 flex items-center justify-center
            ${item.isDirectory ? 'opacity-60 hover:opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          <ExpandIcon expanded={item.isExpanded ?? false} />
        </span>

        {/* 文件图标 */}
        <span
          className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`}
        >
          <FileIcon type={iconType} isSelected={isSelected} />
        </span>

        {/* 文件名 */}
        <span className="truncate flex-1">{item.name}</span>
      </div>

      {/* 递归渲染子项 */}
      {item.isDirectory && item.isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={child}
              level={level + 1}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
})
