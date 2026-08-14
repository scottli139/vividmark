import { memo, useCallback, useEffect, useRef } from 'react'
import type { FileTreeItem as FileTreeItemType } from '../../lib/fileTreeUtils'
import { getFileIconType } from '../../lib/fileTreeUtils'
import { FileIcon } from './FileIcon'
import { InlineNameInput } from './InlineNameInput'

/** 新建操作的行内输入状态（parentPath = 目标文件夹） */
export interface CreatingState {
  parentPath: string
  kind: 'file' | 'folder'
}

interface FileTreeItemProps {
  item: FileTreeItemType
  level: number
  selectedPath: string | null
  /** 正在重命名的项路径 */
  editingPath: string | null
  /** 正在进行的新建操作 */
  creating: CreatingState | null
  onToggle: (item: FileTreeItemType) => void
  onSelect: (item: FileTreeItemType) => void
  onContextMenu: (item: FileTreeItemType, e: React.MouseEvent) => void
  onRenameSubmit: (item: FileTreeItemType, newName: string) => void
  onRenameCancel: () => void
  onCreateSubmit: (name: string) => void
  onCreateCancel: () => void
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

interface RenameInputProps {
  item: FileTreeItemType
  onSubmit: (item: FileTreeItemType, newName: string) => void
  onCancel: () => void
}

/** 行内重命名输入框：Enter 提交，Esc / 失焦取消 */
function RenameInput({ item, onSubmit, onCancel }: RenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  // Enter/Esc 后组件卸载会再触发 blur，用 ref 防止重复回调
  const doneRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    if (doneRef.current) return
    doneRef.current = true
    onSubmit(item, inputRef.current?.value ?? '')
  }

  const cancel = () => {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={item.name}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          submit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancel()
        }
      }}
      onBlur={cancel}
      className="flex-1 min-w-0 px-1 text-[13px] bg-[var(--editor-bg)]
        text-[var(--color-text)] border border-[var(--accent-color)] rounded outline-none"
    />
  )
}

export const FileTreeItem = memo(function FileTreeItem({
  item,
  level,
  selectedPath,
  editingPath,
  creating,
  onToggle,
  onSelect,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
  onCreateSubmit,
  onCreateCancel,
}: FileTreeItemProps) {
  const isSelected = selectedPath === item.path
  const isEditing = editingPath === item.path
  const iconType = getFileIconType(item)

  const handleClick = useCallback(() => {
    if (isEditing) return
    if (item.isDirectory) {
      onToggle(item)
    } else {
      onSelect(item)
    }
  }, [item, isEditing, onToggle, onSelect])

  const handleToggleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggle(item)
    },
    [item, onToggle]
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu(item, e)
    },
    [item, onContextMenu]
  )

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`
          flex items-center gap-1 px-2 py-1 mx-1 rounded-md cursor-pointer text-[13px]
          transition-colors duration-150
          ${
            isSelected
              ? 'bg-[var(--accent-color)]/15 text-[var(--accent-color)] font-medium'
              : 'hover:bg-[var(--hover-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }
        `}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        title={item.path}
      >
        {/* 展开/折叠指示器 */}
        <span
          onClick={handleToggleClick}
          className={`
            w-4 h-4 flex items-center justify-center flex-shrink-0
            ${item.isDirectory ? 'opacity-60 hover:opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          <ExpandIcon expanded={item.isExpanded ?? false} />
        </span>

        {/* 文件图标 */}
        <span
          className={`flex-shrink-0 ${isSelected ? 'text-[var(--accent-color)]' : 'text-[var(--color-text-secondary)]'}`}
        >
          <FileIcon type={iconType} isSelected={isSelected} />
        </span>

        {/* 文件名 / 行内重命名输入框 */}
        {isEditing ? (
          <RenameInput item={item} onSubmit={onRenameSubmit} onCancel={onRenameCancel} />
        ) : (
          <span className="truncate flex-1">{item.name}</span>
        )}
      </div>

      {/* 递归渲染子项 */}
      {item.isDirectory && item.isExpanded && (
        <div>
          {item.children?.map((child) => (
            <FileTreeItem
              key={child.path}
              item={child}
              level={level + 1}
              selectedPath={selectedPath}
              editingPath={editingPath}
              creating={creating}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
            />
          ))}
          {/* 新建操作的临时输入行（追加在目标文件夹子项末尾） */}
          {creating && creating.parentPath === item.path && (
            <InlineNameInput
              level={level + 1}
              isDirectory={creating.kind === 'folder'}
              onSubmit={onCreateSubmit}
              onCancel={onCreateCancel}
            />
          )}
        </div>
      )}
    </div>
  )
})
