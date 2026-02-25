import { useState, useCallback, useRef, useEffect } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { parseMarkdown } from '../../lib/markdown/parser'
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
        type: currentType
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
  return blocks
}

// 将块合并回 Markdown 内容
function blocksToContent(blocks: Block[]): string {
  return blocks.map(b => b.content).join('\n\n')
}

export function Editor() {
  const { content, setContent, isDarkMode } = useEditorStore()
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(content))
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 同步内容到 store
  useEffect(() => {
    const newContent = blocksToContent(blocks)
    if (newContent !== content) {
      setContent(newContent)
    }
  }, [blocks])

  // 处理块聚焦
  const handleBlockFocus = useCallback((blockId: string) => {
    setActiveBlockId(blockId)
  }, [])

  // 处理块失焦
  const handleBlockBlur = useCallback((blockId: string, newContent: string) => {
    setBlocks(prev => prev.map(b =>
      b.id === blockId ? { ...b, content: newContent } : b
    ))
    setActiveBlockId(null)
  }, [])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
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
            onKeyDown={(e) => handleKeyDown(e, block.id)}
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

function BlockRenderer({ block, isActive, onFocus, onBlur, onKeyDown, textareaRef }: BlockRendererProps) {
  const [editContent, setEditContent] = useState(block.content)

  // 同步 block.content 变化
  useEffect(() => {
    setEditContent(block.content)
  }, [block.content])

  // 渲染模式
  if (!isActive) {
    return (
      <div
        className="cursor-text rounded px-1 -mx-1 hover:bg-[var(--editor-border)]/30 transition-colors"
        onClick={onFocus}
        dangerouslySetInnerHTML={{ __html: parseMarkdown(block.content) }}
      />
    )
  }

  // 编辑模式
  return (
    <textarea
      ref={textareaRef}
      value={editContent}
      onChange={(e) => setEditContent(e.target.value)}
      onBlur={() => onBlur(editContent)}
      onKeyDown={onKeyDown}
      className="w-full min-h-[60px] p-2 border-2 border-[var(--accent-color)] rounded-lg bg-transparent outline-none resize-none font-mono text-sm"
      autoFocus
    />
  )
}
