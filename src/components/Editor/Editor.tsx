import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { parseMarkdown } from '../../lib/markdown/parser'
import { useTextFormat, type FormatType } from '../../hooks/useTextFormat'
import { useHistory } from '../../hooks/useHistory'
import { editorLogger } from '../../lib/logger'
import '../../styles/globals.css'

interface Block {
  id: string
  content: string
  type: 'paragraph' | 'heading' | 'code' | 'list' | 'blockquote' | 'other'
}

// 将 Markdown 内容分割成块
function parseBlocks(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  let currentBlock: string[] = []
  let currentType: Block['type'] = 'paragraph'
  let inCodeBlock = false

  const getBlockType = (line: string): Block['type'] => {
    if (line.startsWith('#')) return 'heading'
    if (line.startsWith('```')) return 'code'
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) return 'list'
    if (line.startsWith('>')) return 'blockquote'
    return 'paragraph'
  }

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      blocks.push({
        id: `block-${blocks.length}`,
        content: currentBlock.join('\n'),
        type: currentType,
      })
      currentBlock = []
    }
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        currentBlock.push(line)
        flushBlock()
        inCodeBlock = false
      } else {
        flushBlock()
        inCodeBlock = true
        currentType = 'code'
        currentBlock.push(line)
      }
      continue
    }

    if (inCodeBlock) {
      currentBlock.push(line)
      continue
    }

    const lineType = getBlockType(line)

    if (line.trim() === '') {
      flushBlock()
      continue
    }

    if (currentBlock.length === 0) {
      currentType = lineType
      currentBlock.push(line)
    } else if (lineType === currentType && (lineType === 'list' || lineType === 'blockquote')) {
      currentBlock.push(line)
    } else {
      flushBlock()
      currentType = lineType
      currentBlock.push(line)
    }
  }

  flushBlock()

  // 确保至少有一个块，以便用户可以开始输入
  if (blocks.length === 0) {
    blocks.push({
      id: 'block-0',
      content: '',
      type: 'paragraph',
    })
  }

  return blocks
}

// 将块合并回 Markdown 内容
function blocksToContent(blocks: Block[]): string {
  return blocks.map((b) => b.content).join('\n\n')
}

export function Editor() {
  const { content, setContent, isDarkMode, setCanUndo, setCanRedo } = useEditorStore()
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(content))
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevContentRef = useRef(content)

  // 历史记录管理
  const { pushHistory, undo, redo, canUndo, canRedo, clearHistory } = useHistory(
    content,
    setContent
  )

  // 当外部更新 content 时（如打开文件），同步 blocks
  // 使用 ref 追踪是否是外部更新，避免循环同步
  const isExternalUpdateRef = useRef(false)
  const isUndoRedoRef = useRef(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (content !== prevContentRef.current && !activeBlockId) {
      // 标记这是外部更新
      isExternalUpdateRef.current = true
      prevContentRef.current = content
      editorLogger.debug('External content update, syncing blocks:', {
        contentLength: content.length,
      })
      setBlocks(parseBlocks(content))
      // 外部更新（如打开文件）时清空历史
      clearHistory()
    }
  }, [content, activeBlockId, clearHistory])

  // 同步内容到 store - 仅在用户编辑时同步，跳过外部更新
  const blocksContent = useMemo(() => blocksToContent(blocks), [blocks])
  useEffect(() => {
    // 如果是外部更新触发的 blocks 变化，不同步回 store
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false
      // 更新 prevContentRef 以保持一致
      prevContentRef.current = blocksContent
      editorLogger.debug('Skipping sync - external update')
      return
    }
    if (blocksContent !== content && !activeBlockId) {
      editorLogger.debug('Syncing blocks to store:', {
        blocksCount: blocks.length,
        contentLength: blocksContent.length,
      })
      setContent(blocksContent)
      // 更新 prevContentRef 以防止外部更新效果重置 blocks
      prevContentRef.current = blocksContent
    }
  }, [blocksContent, content, setContent, activeBlockId, blocks.length])
  /* eslint-enable react-hooks/set-state-in-effect */

  // 更新历史状态
  useEffect(() => {
    setCanUndo(canUndo())
    setCanRedo(canRedo())
  }, [content, canUndo, canRedo, setCanUndo, setCanRedo])

  // 监听撤销/重做事件
  useEffect(() => {
    const handleUndo = () => {
      const newContent = undo()
      if (newContent !== null) {
        isUndoRedoRef.current = true
        setBlocks(parseBlocks(newContent))
        prevContentRef.current = newContent
      }
    }

    const handleRedo = () => {
      const newContent = redo()
      if (newContent !== null) {
        isUndoRedoRef.current = true
        setBlocks(parseBlocks(newContent))
        prevContentRef.current = newContent
      }
    }

    window.addEventListener('editor-undo', handleUndo)
    window.addEventListener('editor-redo', handleRedo)

    return () => {
      window.removeEventListener('editor-undo', handleUndo)
      window.removeEventListener('editor-redo', handleRedo)
    }
  }, [undo, redo])

  // 处理键盘快捷键 (Cmd/Ctrl + Z, Cmd/Ctrl + Shift + Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框中的快捷键（除了当前活跃的 textarea）
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || (target.tagName === 'TEXTAREA' && !activeBlockId)) {
        return
      }

      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('editor-undo'))
      } else if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('editor-redo'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBlockId])

  // 全局处理编辑器插入事件（用于图片插入等）
  useEffect(() => {
    const handleInsertEvent = (e: CustomEvent<{ text: string }>) => {
      const { text } = e.detail

      // 如果有活跃的块，让 BlockRenderer 处理
      // 如果没有活跃的块，激活第一个块并插入
      if (!activeBlockId && blocks.length > 0) {
        // 激活第一个块
        setActiveBlockId(blocks[0].id)

        // 在下一个 tick 插入文本（等待 textarea 渲染）
        setTimeout(() => {
          const textarea = document.querySelector('textarea')
          if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const content = textarea.value
            const newContent = content.slice(0, start) + text + content.slice(end)
            textarea.value = newContent
            textarea.setSelectionRange(start + text.length, start + text.length)
            textarea.dispatchEvent(new Event('input', { bubbles: true }))
          }
        }, 50)
      }
    }

    window.addEventListener('editor-insert', handleInsertEvent as EventListener)
    return () => window.removeEventListener('editor-insert', handleInsertEvent as EventListener)
  }, [activeBlockId, blocks])

  // 处理块聚焦
  const handleBlockFocus = useCallback((blockId: string) => {
    setActiveBlockId(blockId)
  }, [])

  // 处理块失焦
  const handleBlockBlur = useCallback(
    (blockId: string, newContent: string) => {
      // 计算新的完整内容并立即更新 prevContentRef
      // 这样可以防止外部更新效果重置 blocks
      setBlocks((prev) => {
        const oldBlock = prev.find((b) => b.id === blockId)
        const newBlocks = prev.map((b) => (b.id === blockId ? { ...b, content: newContent } : b))

        // 计算新的完整内容
        const newFullContent = blocksToContent(newBlocks)

        // 立即更新 prevContentRef，防止外部更新效果重置
        prevContentRef.current = newFullContent

        // 如果内容有变化，推送到历史记录并更新 store
        if (oldBlock && oldBlock.content !== newContent) {
          pushHistory(newFullContent)
          // 立即更新 store，防止外部更新效果重置
          setContent(newFullContent)
        }
        return newBlocks
      })
      setActiveBlockId(null)
    },
    [pushHistory, setContent]
  )

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setActiveBlockId(null)
    }
  }, [])

  return (
    <div className={`flex-1 overflow-auto ${isDarkMode ? 'dark' : ''}`}>
      <div className="markdown-body min-h-full">
        {blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            isActive={activeBlockId === block.id}
            onFocus={() => handleBlockFocus(block.id)}
            onBlur={(content) => handleBlockBlur(block.id, content)}
            onKeyDown={(e) => handleKeyDown(e)}
            textareaRef={activeBlockId === block.id ? textareaRef : undefined}
          />
        ))}
      </div>
    </div>
  )
}

interface BlockRendererProps {
  block: Block
  isActive: boolean
  onFocus: () => void
  onBlur: (content: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

function BlockRenderer({
  block,
  isActive,
  onFocus,
  onBlur,
  onKeyDown,
  textareaRef,
}: BlockRendererProps) {
  // 使用 block.content 作为初始值
  const [editContent, setEditContent] = useState(() => block.content)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const { formatText, toggleBlockPrefix } = useTextFormat()
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null)
  const actualRef = textareaRef || internalTextareaRef

  // 同步 block.content 变化 - 这是 props-to-state 同步的标准模式
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setEditContent(block.content)
  }, [block.content])
  /* eslint-enable react-hooks/set-state-in-effect */

  // 监听格式化事件
  useEffect(() => {
    if (!isActive) return

    const handleFormatEvent = (e: CustomEvent<{ format: FormatType }>) => {
      const { format } = e.detail
      const textarea = actualRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd

      // 块级格式化
      if (['h1', 'h2', 'h3', 'quote', 'list'].includes(format)) {
        const newText = toggleBlockPrefix(
          editContent,
          format as 'h1' | 'h2' | 'h3' | 'quote' | 'list'
        )
        setEditContent(newText)
        return
      }

      // 行内格式化
      const result = formatText(editContent, format, { start, end })
      setEditContent(result.text)

      // 恢复光标位置
      requestAnimationFrame(() => {
        textarea.focus()
        if (result.selectLength) {
          textarea.setSelectionRange(result.cursorPos, result.cursorPos + result.selectLength)
        } else {
          textarea.setSelectionRange(result.cursorPos, result.cursorPos)
        }
      })
    }

    // 监听文本插入事件（用于图片插入等）
    const handleInsertEvent = (e: CustomEvent<{ text: string }>) => {
      const { text } = e.detail
      const textarea = actualRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const before = editContent.slice(0, start)
      const after = editContent.slice(end)
      const newContent = before + text + after

      setEditContent(newContent)

      // 恢复光标位置到插入文本之后
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(start + text.length, start + text.length)
      })
    }

    window.addEventListener('editor-format', handleFormatEvent as EventListener)
    window.addEventListener('editor-insert', handleInsertEvent as EventListener)
    return () => {
      window.removeEventListener('editor-format', handleFormatEvent as EventListener)
      window.removeEventListener('editor-insert', handleInsertEvent as EventListener)
    }
  }, [isActive, editContent, formatText, toggleBlockPrefix, actualRef])

  // 处理进入编辑模式
  const handleFocus = useCallback(() => {
    setIsTransitioning(true)
    onFocus()
    // 延迟移除过渡状态
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsTransitioning(false)
      })
    })
  }, [onFocus])

  // 处理退出编辑模式
  const handleBlur = useCallback(() => {
    setIsTransitioning(true)
    onBlur(editContent)
    requestAnimationFrame(() => {
      setIsTransitioning(false)
    })
  }, [editContent, onBlur])

  return (
    <div className="relative group">
      {/* 渲染模式 - 始终存在，通过 opacity 控制显示 */}
      <div
        className={`cursor-text rounded px-1 -mx-1 hover:bg-[var(--editor-border)]/30 transition-all duration-150 min-h-[1.5em] ${
          isActive ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        onClick={handleFocus}
      >
        {block.content ? (
          <div dangerouslySetInnerHTML={{ __html: parseMarkdown(block.content) }} />
        ) : (
          <span className="text-[var(--editor-border)] italic">Click to start typing...</span>
        )}
      </div>

      {/* 编辑模式 - 叠加在渲染内容上 */}
      {isActive && (
        <div
          className={`absolute inset-0 transition-all duration-150 ${
            isTransitioning ? 'animate-fade-in' : ''
          }`}
        >
          <textarea
            ref={actualRef}
            value={editContent}
            onChange={(e) => {
              setEditContent(e.target.value)
              // 自动调整高度
              e.target.style.height = 'auto'
              e.target.style.height = e.target.scrollHeight + 'px'
            }}
            onBlur={handleBlur}
            onKeyDown={onKeyDown}
            className="w-full min-h-[120px] p-3 border-2 border-[var(--accent-color)] rounded-lg bg-[var(--editor-bg)] outline-none resize-y font-mono text-sm shadow-sm"
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
