import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../stores/editorStore'
import { generateTable } from '../../lib/tableUtils'
import { TableDialog } from '../TableDialog'
import { AdmonitionDialog } from '../AdmonitionDialog'
import { MoreMenu } from './MoreMenu'
import { WindowControls } from './WindowControls'
import { isMacOSDesktop, isLinuxDesktop } from '../../lib/platform'

/**
 * 工具栏（极简）：右侧更多菜单（缩放 / 主题 / 导出 PDF / 语言 / 设置）；侧边栏开关
 * 在状态栏左侧。视图模式切换在状态栏右侧（点按弹出菜单）；撤销/重做、文件操作与
 * 格式化/插入全部由
 * 原生菜单（文件/编辑/段落/格式）+ 编辑器右键菜单 + 快捷键覆盖。表格/提示框对话框
 * 仍挂载在此，由 app-open-dialog 事件触发（原生菜单 insert:table / insert:admonition）。
 */
export function Toolbar() {
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [isAdmonitionDialogOpen, setIsAdmonitionDialogOpen] = useState(false)
  const { t } = useTranslation()

  const { fileName, isDirty } = useEditorStore()

  // 更新窗口标题（Typora 式：文件名 + 脏标记；Dock 窗口列表/Mission Control 依此区分文档）。
  // 走 Rust 命令而非 JS setTitle：macOS 上 setTitle 会把红绿灯重置回默认位置，
  // 需要在设标题后立即重排（src-tauri/src/titlebar.rs）
  useEffect(() => {
    const updateTitle = async () => {
      try {
        const dirtyMark = isDirty ? ' ●' : ''
        const baseTitle = fileName === 'Untitled.md' ? t('app.untitled') : fileName
        await invoke('set_window_title', { title: `${baseTitle}${dirtyMark}` })
      } catch {
        // 在浏览器环境中会失败，忽略错误
      }
    }
    updateTitle()
  }, [fileName, isDirty, t])

  // 原生菜单/其他入口经事件打开插入对话框
  useEffect(() => {
    const handleOpenDialog = (e: Event) => {
      const { dialog } = (e as CustomEvent<{ dialog: string }>).detail
      if (dialog === 'table') setIsTableDialogOpen(true)
      else if (dialog === 'admonition') setIsAdmonitionDialogOpen(true)
    }
    window.addEventListener('app-open-dialog', handleOpenDialog)
    return () => window.removeEventListener('app-open-dialog', handleOpenDialog)
  }, [])

  const handleInsertTable = useCallback((rows: number, cols: number) => {
    const tableMarkdown = generateTable(rows, cols)
    window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text: tableMarkdown } }))
  }, [])

  const handleInsertAdmonition = useCallback((type: string, title: string) => {
    const text = `::: ${type}${title ? ` ${title}` : ''}\n\n:::\n`
    window.dispatchEvent(new CustomEvent('editor-insert', { detail: { text } }))
  }, [])

  // macOS 融合标题栏：预留 traffic light 区域 + 自绘文件名（hiddenTitle 后系统标题不可见）
  // Linux 无边框：窗口 decorations 已关，工具栏兼作标题栏——自绘居中文件名 +
  // 窗口控制按钮（左右容器 flex-1 basis-0 等宽，保证标题真正居中）；两者都是
  // data-tauri-drag-region 拖拽区，双击切换最大化由 tauri 内建 drag.js 处理
  const macFusion = isMacOSDesktop()
  const linuxFrameless = isLinuxDesktop()
  const displayTitle = fileName === 'Untitled.md' ? t('app.untitled') : fileName

  return (
    <div
      data-tauri-drag-region
      className={`h-12 flex items-center justify-between px-3 border-b border-[var(--editor-border)] bg-[var(--toolbar-bg)] ${
        macFusion ? 'pl-[78px]' : ''
      }`}
    >
      {/* 左侧 - 占位（macOS：与右侧 ⋮ 按钮同宽；Linux：与右侧按钮组等宽，保持标题居中） */}
      <div data-tauri-drag-region className={linuxFrameless ? 'flex-1 basis-0 min-w-0' : 'w-7'} />

      {/* macOS/Linux 自绘文件名（弹性占位 + 截断防重叠，窄窗口隐藏） */}
      {(macFusion || linuxFrameless) && (
        <div
          className={`min-w-0 truncate text-center text-xs font-medium text-[var(--color-text-secondary)] pointer-events-none select-none hidden min-[760px]:block ${
            linuxFrameless ? 'max-w-[50%]' : 'flex-1'
          }`}
        >
          {displayTitle}
          {isDirty ? ' ●' : ''}
        </div>
      )}

      {/* 右侧 - 更多菜单（+ Linux 窗口控制按钮） */}
      <div
        data-tauri-drag-region
        className={`flex items-center gap-1 ${linuxFrameless ? 'flex-1 basis-0 min-w-0 justify-end' : ''}`}
      >
        <MoreMenu />
        {linuxFrameless && <WindowControls />}
      </div>

      {/* 表格插入对话框 */}
      <TableDialog
        isOpen={isTableDialogOpen}
        onClose={() => setIsTableDialogOpen(false)}
        onInsert={handleInsertTable}
      />

      {/* Admonition 插入对话框 */}
      <AdmonitionDialog
        isOpen={isAdmonitionDialogOpen}
        onClose={() => setIsAdmonitionDialogOpen(false)}
        onInsert={handleInsertAdmonition}
      />
    </div>
  )
}
