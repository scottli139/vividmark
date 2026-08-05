import { useState, useCallback, useRef, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-shell'
import type { EditorView } from '@codemirror/view'
import { useEditorStore } from '../../stores/editorStore'
import { parseMarkdownAsync } from '../../lib/markdown/parser'
import { printToPdf } from '../../lib/exportPdf'
import { scrollPreviewToHeading } from '../../lib/outlineUtils'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { WysiwygEditor } from './WysiwygEditor'
import '../../styles/globals.css'

export function Editor() {
  const { content, setContent, viewMode, filePath, zoomLevel } = useEditorStore()

  const [renderedHtml, setRenderedHtml] = useState('')
  const cmViewRef = useRef<EditorView | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  // 全局快捷键监听（包括缩放）- 在 Preview 模式下也能使用
  // 使用 getState() 避免闭包问题
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      const store = useEditorStore.getState()

      // 缩放快捷键
      if (isMod && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        store.zoomIn()
      } else if (isMod && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        store.zoomOut()
      } else if (isMod && (e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault()
        store.zoomReset()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // 同步滚动状态
  const isSyncingScroll = useRef(false)
  const sourceScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 同步滚动（Split 模式 - Source → Preview）
  const handleSourceScroll = useCallback(
    (scroller: HTMLElement) => {
      if (viewMode === 'split' && previewContainerRef.current && !isSyncingScroll.current) {
        const previewContainer = previewContainerRef.current

        isSyncingScroll.current = true

        const scrollPercentage =
          scroller.scrollTop / (scroller.scrollHeight - scroller.clientHeight || 1)
        previewContainer.scrollTop =
          scrollPercentage * (previewContainer.scrollHeight - previewContainer.clientHeight)

        if (sourceScrollTimeout.current) {
          clearTimeout(sourceScrollTimeout.current)
        }
        sourceScrollTimeout.current = setTimeout(() => {
          isSyncingScroll.current = false
        }, 50)
      }
    },
    [viewMode]
  )

  // 同步滚动（Split 模式 - Preview → Source）
  const handlePreviewScroll = useCallback(() => {
    const scroller = cmViewRef.current?.scrollDOM
    if (viewMode === 'split' && scroller && !isSyncingScroll.current) {
      const previewContainer = previewContainerRef.current
      if (!previewContainer) return

      isSyncingScroll.current = true

      const scrollPercentage =
        previewContainer.scrollTop /
        (previewContainer.scrollHeight - previewContainer.clientHeight || 1)
      scroller.scrollTop = scrollPercentage * (scroller.scrollHeight - scroller.clientHeight)

      if (previewScrollTimeout.current) {
        clearTimeout(previewScrollTimeout.current)
      }
      previewScrollTimeout.current = setTimeout(() => {
        isSyncingScroll.current = false
      }, 50)
    }
  }, [viewMode])

  // 异步渲染 HTML（支持本地图片转换），120ms 防抖：输入停止后再渲染
  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(() => {
      const render = async () => {
        // 提取文档目录作为 baseDir（支持 Windows 和 Unix 路径）
        let baseDir: string | undefined
        if (filePath) {
          // 处理 Windows 路径(\)和 Unix 路径(/)
          const lastSlash = filePath.lastIndexOf('/')
          const lastBackslash = filePath.lastIndexOf('\\')
          const separatorIndex = Math.max(lastSlash, lastBackslash)
          baseDir = separatorIndex > 0 ? filePath.substring(0, separatorIndex) : undefined
        }
        const html = await parseMarkdownAsync(content, baseDir)

        if (!cancelled) {
          setRenderedHtml(html)
        }
      }

      render()
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, filePath])

  // HTML 更新后同步 checkbox 状态（解决 dangerouslySetInnerHTML 与浏览器状态的冲突）
  useEffect(() => {
    if (previewContainerRef.current) {
      const checkboxes = previewContainerRef.current.querySelectorAll('.task-checkbox')
      checkboxes.forEach((checkbox) => {
        const el = checkbox as HTMLInputElement
        const status = el.getAttribute('data-task-status')
        const shouldBeChecked = status === 'checked'
        if (el.checked !== shouldBeChecked) {
          el.checked = shouldBeChecked
        }
      })
    }
  }, [renderedHtml])

  // 监听大纲点击事件 - 滚动到对应标题
  // Source/Split 模式由 CodeMirrorEditor 处理，这里只处理 Preview 模式
  useEffect(() => {
    const handleScrollToHeading = (
      e: CustomEvent<{ charIndex: number; lineIndex: number; index: number }>
    ) => {
      const { index } = e.detail

      if (viewMode === 'preview') {
        // Preview 模式：滚动预览区域到对应 heading
        const previewContainer = previewContainerRef.current
        if (previewContainer) {
          scrollPreviewToHeading(previewContainer, index)
        }
      }
    }

    window.addEventListener('editor-scroll-to-heading', handleScrollToHeading as EventListener)
    return () => {
      window.removeEventListener('editor-scroll-to-heading', handleScrollToHeading as EventListener)
    }
  }, [viewMode])

  // 监听 PDF 导出请求事件
  useEffect(() => {
    const handleRequestHtml = () => {
      // 使用 WebView 原生打印功能导出 PDF
      printToPdf()
    }

    window.addEventListener('editor-request-html', handleRequestHtml as EventListener)
    return () => {
      window.removeEventListener('editor-request-html', handleRequestHtml as EventListener)
    }
  }, [])

  // ==================== 任务列表 (Checkbox) 点击处理 ====================
  // 切换指定索引的任务 checkbox 状态
  const toggleTaskCheckbox = useCallback(
    (taskIndex: number, newChecked: boolean) => {
      const lines = content.split('\n')
      let currentTaskIndex = 0

      // 遍历所有行，找到对应索引的任务列表项
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // 匹配任务列表语法: - [ ] 或 - [x]
        const taskMatch = line.match(/^(\s*)([-*])\s+\[([\sxX])\]\s+(.*)$/)

        if (taskMatch) {
          if (currentTaskIndex === taskIndex) {
            // 找到目标行，切换状态
            const indent = taskMatch[1]
            const marker = taskMatch[2]
            const text = taskMatch[4]
            const newStatus = newChecked ? 'x' : ' '

            lines[i] = `${indent}${marker} [${newStatus}] ${text}`

            // 更新内容（CodeMirrorEditor 监听 store 变化后同步整篇替换）
            setContent(lines.join('\n'))
            return
          }
          currentTaskIndex++
        }
      }
    },
    [content, setContent]
  )

  // 处理预览区域的 checkbox 点击事件和链接点击事件
  const handlePreviewClick = useCallback(
    async (e: React.MouseEvent) => {
      const target = e.target as HTMLElement

      // 检查点击的是否是任务列表的 checkbox
      if (target.classList.contains('task-checkbox')) {
        const checkbox = target as HTMLInputElement
        const taskIndex = parseInt(checkbox.getAttribute('data-task-index') || '-1', 10)
        const currentStatus = checkbox.getAttribute('data-task-status')

        if (taskIndex >= 0) {
          e.preventDefault()
          // 使用 data-task-status 来判断当前状态，而不是 checkbox.checked
          // 因为浏览器会在 click 事件触发前自动切换 checkbox 的 checked 属性
          const isChecked = currentStatus === 'checked'
          toggleTaskCheckbox(taskIndex, !isChecked)
        }
        return
      }

      // 检查点击的是否是链接（或链接内的元素）
      const linkElement = target.closest('a[href]') as HTMLAnchorElement | null
      if (linkElement) {
        const href = linkElement.getAttribute('href')
        if (href) {
          // 阻止默认行为（在应用内打开）
          e.preventDefault()

          // 使用系统浏览器打开外部链接
          try {
            await open(href)
          } catch (error) {
            console.error('Failed to open external link:', error)
          }
        }
        return
      }
    },
    [toggleTaskCheckbox]
  )

  // 编辑器容器：Source/Split 模式可见；Preview/WYSIWYG 模式保持挂载但隐藏
  // （保留 CodeMirror 撤销历史与工具栏事件处理能力）
  const editorWrapperClass =
    viewMode === 'source'
      ? 'flex-1 flex flex-col overflow-hidden'
      : viewMode === 'split'
        ? 'flex-1 flex flex-col overflow-hidden border-r border-[var(--editor-border)]'
        : 'hidden'

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* CodeMirror 编辑器（Source/Split） */}
      <div className={editorWrapperClass}>
        <CodeMirrorEditor onScroll={handleSourceScroll} viewRef={cmViewRef} />
      </div>

      {/* WYSIWYG 编辑器（常驻挂载，非激活时隐藏，同 CodeMirror） */}
      <div className={viewMode === 'wysiwyg' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
        <WysiwygEditor />
      </div>

      {/* 预览区域（Preview/Split） */}
      {(viewMode === 'preview' || viewMode === 'split') && (
        <div
          ref={previewContainerRef}
          className="flex-1 overflow-auto"
          onScroll={viewMode === 'split' ? handlePreviewScroll : undefined}
        >
          <div
            className="markdown-body min-h-full p-8 origin-top-left"
            style={{ zoom: `${zoomLevel}%` }}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
            onClick={handlePreviewClick}
          />
        </div>
      )}
    </div>
  )
}
