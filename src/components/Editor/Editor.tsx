import { useState, useCallback, useRef, useEffect } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { parseMarkdownAsync } from '../../lib/markdown/parser'
import { useTextFormat, type FormatType } from '../../hooks/useTextFormat'
import { useHistory } from '../../hooks/useHistory'
import { scrollToPosition, scrollPreviewToHeading } from '../../lib/outlineUtils'
import '../../styles/globals.css'

export function Editor() {
  const { content, setContent, isDarkMode, viewMode, setCanUndo, setCanRedo, filePath } =
    useEditorStore()

  // 本地编辑状态（用于 Source 和 Split 模式）
  const [localContent, setLocalContent] = useState(content)
  const [renderedHtml, setRenderedHtml] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 格式化工具
  const { formatText, toggleBlockPrefix } = useTextFormat()

  // 历史记录管理 - 使用 ref 获取最新 localContent
  const localContentRef = useRef(localContent)
  useEffect(() => {
    localContentRef.current = localContent
  }, [localContent])

  const getCurrentContent = useCallback(() => localContentRef.current, [])

  const { pushHistory, undo, redo, canUndo, canRedo, clearHistory } = useHistory(
    getCurrentContent,
    setContent
  )

  // 处理内容变化
  const handleContentChange = useCallback(
    (newContent: string) => {
      setLocalContent(newContent)

      // 同步到全局 store
      setContent(newContent)

      // 推送到历史记录（防抖）
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      typingTimeoutRef.current = setTimeout(() => {
        pushHistory(newContent)
      }, 500)
    },
    [setContent, pushHistory]
  )

  // 处理键盘快捷键
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey

    if (isMod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('editor-undo'))
    } else if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) {
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('editor-redo'))
    }
  }, [])

  // 同步滚动状态
  const isSyncingScroll = useRef(false)
  const sourceScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewScrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 同步滚动（Split 模式 - Source → Preview）
  const handleSourceScroll = useCallback(() => {
    if (viewMode === 'split' && previewContainerRef.current && !isSyncingScroll.current) {
      const textarea = textareaRef.current
      const previewContainer = previewContainerRef.current
      if (!textarea) return

      isSyncingScroll.current = true

      const scrollPercentage =
        textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight || 1)
      previewContainer.scrollTop =
        scrollPercentage * (previewContainer.scrollHeight - previewContainer.clientHeight)

      if (sourceScrollTimeout.current) {
        clearTimeout(sourceScrollTimeout.current)
      }
      sourceScrollTimeout.current = setTimeout(() => {
        isSyncingScroll.current = false
      }, 50)
    }
  }, [viewMode])

  // 同步滚动（Split 模式 - Preview → Source）
  const handlePreviewScroll = useCallback(() => {
    if (viewMode === 'split' && textareaRef.current && !isSyncingScroll.current) {
      const textarea = textareaRef.current
      const previewContainer = previewContainerRef.current
      if (!previewContainer) return

      isSyncingScroll.current = true

      const scrollPercentage =
        previewContainer.scrollTop /
        (previewContainer.scrollHeight - previewContainer.clientHeight || 1)
      textarea.scrollTop = scrollPercentage * (textarea.scrollHeight - textarea.clientHeight)

      if (previewScrollTimeout.current) {
        clearTimeout(previewScrollTimeout.current)
      }
      previewScrollTimeout.current = setTimeout(() => {
        isSyncingScroll.current = false
      }, 50)
    }
  }, [viewMode])

  // 初始化历史记录 - 只在组件挂载时执行一次
  const isInitializedRef = useRef(false)
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      // 将初始内容推入历史记录
      pushHistory(content)
    }
  }, [content, pushHistory])

  // 当外部 content 变化时（如打开文件），同步本地内容
  const prevFilePathRef = useRef(filePath)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLocalContent(content)
    // 只有文件路径变化时才清空历史（打开新文件）
    // 避免初始加载时清空历史
    if (prevFilePathRef.current !== filePath) {
      prevFilePathRef.current = filePath
      clearHistory()
      // 新文件加载后，将新内容推入历史记录
      pushHistory(content)
    }
  }, [content, filePath, clearHistory, pushHistory])
  /* eslint-enable react-hooks/set-state-in-effect */

  // 更新历史状态到 store（用于 Toolbar 按钮状态）
  useEffect(() => {
    setCanUndo(canUndo())
    setCanRedo(canRedo())
  }, [localContent, canUndo, canRedo, setCanUndo, setCanRedo])

  // 监听撤销/重做事件
  useEffect(() => {
    const handleUndo = () => {
      const newContent = undo()
      if (newContent !== null) {
        setLocalContent(newContent)
      }
    }

    const handleRedo = () => {
      const newContent = redo()
      if (newContent !== null) {
        setLocalContent(newContent)
      }
    }

    window.addEventListener('editor-undo', handleUndo)
    window.addEventListener('editor-redo', handleRedo)

    return () => {
      window.removeEventListener('editor-undo', handleUndo)
      window.removeEventListener('editor-redo', handleRedo)
    }
  }, [undo, redo])

  // 监听插入事件（图片插入等）
  useEffect(() => {
    const handleInsert = (e: CustomEvent<{ text: string }>) => {
      const { text } = e.detail
      const textarea = textareaRef.current

      // 获取当前光标位置（在异步处理前保存）
      const selectionStart = textarea?.selectionStart ?? localContent.length
      const selectionEnd = textarea?.selectionEnd ?? localContent.length

      if (textarea) {
        // 在光标位置插入文本
        const before = localContent.slice(0, selectionStart)
        const after = localContent.slice(selectionEnd)
        const newContent = before + text + after

        handleContentChange(newContent)

        // 恢复光标位置到插入文本之后
        requestAnimationFrame(() => {
          const newCursorPos = selectionStart + text.length
          textarea.setSelectionRange(newCursorPos, newCursorPos)
          textarea.focus()
        })
      } else {
        // 如果没有 textarea（如在 Preview 模式），追加到末尾
        handleContentChange(localContent + '\n\n' + text)
      }
    }

    window.addEventListener('editor-insert', handleInsert as EventListener)
    return () => {
      window.removeEventListener('editor-insert', handleInsert as EventListener)
    }
  }, [localContent, handleContentChange])

  // 监听格式化事件
  useEffect(() => {
    const handleFormat = (e: CustomEvent<{ format: FormatType }>) => {
      const textarea = textareaRef.current
      if (!textarea) return

      const { format } = e.detail
      const selectionStart = textarea.selectionStart
      const selectionEnd = textarea.selectionEnd
      const selectedText = localContent.slice(selectionStart, selectionEnd)

      // 块级格式化（标题、引用、列表）
      const blockFormats: FormatType[] = ['h1', 'h2', 'h3', 'quote', 'list']
      if (blockFormats.includes(format)) {
        // 找到当前行的开始位置
        const lineStart = localContent.lastIndexOf('\n', selectionStart - 1) + 1
        const lineEnd = localContent.indexOf('\n', selectionEnd)
        const actualLineEnd = lineEnd === -1 ? localContent.length : lineEnd
        const currentLine = localContent.slice(lineStart, actualLineEnd)

        const newLine = toggleBlockPrefix(
          currentLine,
          format as 'h1' | 'h2' | 'h3' | 'quote' | 'list'
        )
        const newContent =
          localContent.slice(0, lineStart) + newLine + localContent.slice(actualLineEnd)

        handleContentChange(newContent)

        // 恢复光标位置
        requestAnimationFrame(() => {
          const cursorOffset = newLine.length - currentLine.length
          const newCursorPos = selectionStart + cursorOffset
          textarea.setSelectionRange(newCursorPos, newCursorPos)
          textarea.focus()
        })
      } else {
        // 行内格式化
        const result = formatText(localContent, format, {
          start: selectionStart,
          end: selectionEnd,
        })

        handleContentChange(result.text)

        // 恢复光标位置或选中占位符
        requestAnimationFrame(() => {
          if (selectedText) {
            // 如果有选中文本，光标移到格式化文本之后
            textarea.setSelectionRange(result.cursorPos, result.cursorPos)
          } else if (result.selectLength) {
            // 如果没有选中文本，选中占位符
            const start = result.cursorPos
            const end = start + result.selectLength
            textarea.setSelectionRange(start, end)
          } else {
            textarea.setSelectionRange(result.cursorPos, result.cursorPos)
          }
          textarea.focus()
        })
      }
    }

    window.addEventListener('editor-format', handleFormat as EventListener)
    return () => {
      window.removeEventListener('editor-format', handleFormat as EventListener)
    }
  }, [localContent, handleContentChange, formatText, toggleBlockPrefix])

  // 异步渲染 HTML（支持本地图片转换）
  useEffect(() => {
    let cancelled = false

    const render = async () => {
      // 提取文档目录作为 baseDir
      const baseDir = filePath ? filePath.substring(0, filePath.lastIndexOf('/')) : undefined
      const html = await parseMarkdownAsync(localContent, baseDir)

      if (!cancelled) {
        setRenderedHtml(html)
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [localContent, filePath])

  // 监听大纲点击事件 - 滚动到对应标题
  useEffect(() => {
    const handleScrollToHeading = (
      e: CustomEvent<{ charIndex: number; lineIndex: number; index: number }>
    ) => {
      const { charIndex, index } = e.detail

      if (viewMode === 'source' || viewMode === 'split') {
        // Source/Split 模式：滚动 textarea
        const textarea = textareaRef.current
        if (textarea) {
          scrollToPosition(textarea, charIndex, 24)
        }
      } else if (viewMode === 'preview') {
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

  // Source 模式：纯源码编辑
  if (viewMode === 'source') {
    return (
      <div className={`flex-1 flex flex-col ${isDarkMode ? 'dark' : ''}`}>
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 w-full p-8 bg-[var(--editor-bg)] text-[var(--text-primary)] 
                     font-mono text-sm leading-relaxed resize-none outline-none
                     border-none focus:ring-0 overflow-auto"
          spellCheck={false}
          autoFocus
        />
      </div>
    )
  }

  // Preview 模式：只读预览
  if (viewMode === 'preview') {
    return (
      <div
        ref={previewContainerRef}
        className={`flex-1 overflow-auto ${isDarkMode ? 'dark' : ''}`}
      >
        <div
          className="markdown-body min-h-full p-8"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    )
  }

  // Split 模式：左源码右预览
  return (
    <div className={`flex-1 flex overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      {/* 左侧：源码 */}
      <div className="flex-1 flex flex-col border-r border-[var(--editor-border)]">
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={() => handleSourceScroll()}
          className="flex-1 w-full p-8 bg-[var(--editor-bg)] text-[var(--text-primary)] 
                     font-mono text-sm leading-relaxed resize-none outline-none
                     border-none focus:ring-0 overflow-auto"
          spellCheck={false}
          autoFocus
        />
      </div>

      {/* 右侧：预览 */}
      <div
        ref={previewContainerRef}
        className="flex-1 overflow-auto"
        onScroll={() => handlePreviewScroll()}
      >
        <div
          className="markdown-body min-h-full p-8"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
    </div>
  )
}
