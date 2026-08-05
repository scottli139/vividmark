import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileIcon } from './FileIcon'

interface InlineNameInputProps {
  level: number
  isDirectory: boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}

/**
 * 文件树行内名称输入行（新建文件/文件夹用）：Enter 提交，Esc / 失焦取消
 */
export function InlineNameInput({ level, isDirectory, onSubmit, onCancel }: InlineNameInputProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Enter/Esc 后组件卸载会再触发 blur，用 ref 防止重复回调
  const doneRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    if (doneRef.current) return
    doneRef.current = true
    onSubmit(value)
  }

  const cancel = () => {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 text-sm"
      style={{ paddingLeft: `${level * 12 + 8}px` }}
    >
      {/* 与树行的展开箭头占位对齐 */}
      <span className="w-4 h-4 flex-shrink-0" />
      <span className="flex-shrink-0 text-[var(--color-text-secondary)]">
        <FileIcon type={isDirectory ? 'folder' : 'file'} isSelected={false} />
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={t(isDirectory ? 'fileTree.newFolder' : 'fileTree.newFile')}
        onChange={(e) => setValue(e.target.value)}
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
        className="flex-1 min-w-0 px-1 text-sm bg-[var(--editor-bg)]
          text-[var(--color-text)] border border-[var(--accent-color)] rounded outline-none"
      />
    </div>
  )
}
