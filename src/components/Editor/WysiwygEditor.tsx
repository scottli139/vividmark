import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { listenerCtx } from '@milkdown/kit/plugin/listener'
import { redo, undo } from '@milkdown/kit/prose/history'
import { TextSelection } from '@milkdown/kit/prose/state'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { useEditorStore } from '../../stores/editorStore'
import type { FormatType } from '../../lib/markdownEditing'
import { createLogger } from '../../lib/logger'
import { wysiwygPlugins } from './wysiwygPlugins'
import { applyWysiwygFormat, insertWysiwygSnippet } from './wysiwygFormat'

const logger = createLogger('WysiwygEditor')

/** 基础字号（与 CodeMirrorEditor 一致），随 zoomLevel 缩放 */
const BASE_FONT_SIZE = 14
/** 大纲跳转时目标位置距滚动容器顶部的边距（px，与 CodeMirrorEditor 一致） */
const SCROLL_TOP_MARGIN = 72

/**
 * Milkdown WYSIWYG 编辑器
 *
 * 常驻挂载、非激活隐藏（同 CodeMirrorEditor）；以 filePath 为 key 重建实例，
 * 打开新文件时自然清空 ProseMirror 撤销历史、避免内容残留。
 * 编辑器懒创建：仅首次进入 wysiwyg 时初始化（避免在隐藏容器中创建 PM 的潜在问题），
 * 创建失败会显示错误并支持重试。
 */
export function WysiwygEditor({ editorRef: editorRefProp }: WysiwygEditorProps = {}) {
  const filePath = useEditorStore((state) => state.filePath)
  return <WysiwygEditorView key={filePath ?? 'untitled'} editorRef={editorRefProp} />
}

interface WysiwygEditorProps {
  /** 向父组件/测试暴露 Milkdown Editor 实例 */
  editorRef?: React.RefObject<Editor | null>
}

function WysiwygEditorView({ editorRef: editorRefProp }: WysiwygEditorProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  /** 编辑器当前文档的序列化值：store→编辑器同步前的等价判断（防回环） */
  const lastSerializedRef = useRef<string | null>(null)
  /** 创建进行中去重；disposed 处理异步回调与卸载的竞态 */
  const creatingRef = useRef(false)
  const disposedRef = useRef(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const content = useEditorStore((state) => state.content)
  const viewMode = useEditorStore((state) => state.viewMode)
  const zoomLevel = useEditorStore((state) => state.zoomLevel)

  // 创建 Milkdown 编辑器（幂等：已存在/创建中/已卸载则跳过；失败可重试）
  const ensureEditor = useCallback(() => {
    const container = containerRef.current
    if (!container || editorRef.current || creatingRef.current || disposedRef.current) return
    creatingRef.current = true

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, useEditorStore.getState().content)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          // 非 wysiwyg 模式下该编辑器不是编辑权威，忽略其序列化回调
          const store = useEditorStore.getState()
          if (store.viewMode !== 'wysiwyg') return
          lastSerializedRef.current = markdown
          // 与 store 相同则跳过（防回环）
          if (markdown !== store.content) {
            store.setContent(markdown)
          }
        })
      })
      .use(wysiwygPlugins)
      .create()
      .then((created) => {
        creatingRef.current = false
        // StrictMode/卸载竞态：已销毁的实例立即销毁
        if (disposedRef.current) {
          void created.destroy()
          return
        }
        editorRef.current = created
        if (editorRefProp) editorRefProp.current = created
        // macOS/WKWebView 的智能替换（弯引号、自动大写、自动纠错）会悄悄改写
        // 文档字节——markdown 编辑器要求源码与输入一致，全局禁用
        created.action((ctx) => {
          const dom = ctx.get(editorViewCtx).dom
          dom.setAttribute('autocorrect', 'off')
          dom.setAttribute('autocapitalize', 'off')
        })
        // create 是异步的，期间 store 可能又变了；就绪后对齐一次
        const store = useEditorStore.getState()
        const serialized = created.action(getMarkdown())
        if (store.viewMode === 'wysiwyg' && store.content !== serialized) {
          created.action(replaceAll(store.content, true))
          lastSerializedRef.current = created.action(getMarkdown())
        } else {
          lastSerializedRef.current = serialized
        }
        logger.info('WYSIWYG editor created')
      })
      .catch((err: unknown) => {
        creatingRef.current = false
        logger.error('Failed to create WYSIWYG editor:', err)
        setCreateError(err instanceof Error ? err.message : String(err))
      })
  }, [editorRefProp])

  // 挂载：仅当前处于 wysiwyg 时创建（懒创建）；卸载：销毁实例
  useEffect(() => {
    disposedRef.current = false
    if (useEditorStore.getState().viewMode === 'wysiwyg') {
      ensureEditor()
    }
    return () => {
      disposedRef.current = true
      const editor = editorRef.current
      editorRef.current = null
      lastSerializedRef.current = null
      if (editorRefProp) editorRefProp.current = null
      if (editor) void editor.destroy()
    }
  }, [ensureEditor, editorRefProp])

  // 进入 wysiwyg 时确保编辑器存在（懒创建入口 + 创建失败后的自愈）
  useEffect(() => {
    if (viewMode === 'wysiwyg' && !editorRef.current && !createError) {
      ensureEditor()
    }
  }, [viewMode, createError, ensureEditor])

  // window 事件总线（工具栏按钮、大纲跳转）
  // viewMode 分流：仅 wysiwyg 激活时响应（source/split 由 CodeMirrorEditor 处理）
  useEffect(() => {
    const isActive = () => useEditorStore.getState().viewMode === 'wysiwyg'
    const focusIfActive = () => {
      if (!isActive()) return
      editorRef.current?.action((ctx) => ctx.get(editorViewCtx).focus())
    }
    const handleFormatEvent = (e: Event) => {
      if (!isActive()) return
      const { format } = (e as CustomEvent<{ format: FormatType }>).detail
      editorRef.current?.action((ctx) => applyWysiwygFormat(ctx, format))
      focusIfActive()
    }
    const handleInsertEvent = (e: Event) => {
      if (!isActive()) return
      const { text } = (e as CustomEvent<{ text: string }>).detail
      editorRef.current?.action((ctx) => insertWysiwygSnippet(ctx, text))
      focusIfActive()
    }
    const handleUndoEvent = () => {
      if (!isActive()) return
      editorRef.current?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        undo(view.state, view.dispatch)
      })
      focusIfActive()
    }
    const handleRedoEvent = () => {
      if (!isActive()) return
      editorRef.current?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        redo(view.state, view.dispatch)
      })
      focusIfActive()
    }
    // 大纲跳转：定位第 N 个 heading 节点，光标落入 + 平滑滚动（带上边距）
    const handleScrollToHeadingEvent = (e: Event) => {
      if (!isActive()) return
      const { index } = (e as CustomEvent<{ index: number }>).detail
      editorRef.current?.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        let targetPos = -1
        let count = 0
        view.state.doc.descendants((node, pos) => {
          if (targetPos >= 0) return false
          if (node.type.name === 'heading') {
            if (count === index) {
              targetPos = pos
              return false
            }
            count++
          }
          return true
        })
        if (targetPos < 0) return
        view.dispatch(
          view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(targetPos + 1)))
        )
        requestAnimationFrame(() => {
          // rAF 回调可能在编辑器销毁后执行（组件卸载/文件切换竞态）
          if (disposedRef.current) return
          const coords = view.coordsAtPos(targetPos + 1)
          if (!coords) return
          const scroller = view.dom.closest('.overflow-auto') as HTMLElement | null
          if (!scroller) return
          const target = scroller.scrollTop + coords.top - scroller.getBoundingClientRect().top
          scroller.scrollTo({ top: Math.max(0, target - SCROLL_TOP_MARGIN), behavior: 'smooth' })
        })
        view.focus()
      })
    }

    window.addEventListener('editor-format', handleFormatEvent)
    window.addEventListener('editor-insert', handleInsertEvent)
    window.addEventListener('editor-undo', handleUndoEvent)
    window.addEventListener('editor-redo', handleRedoEvent)
    window.addEventListener('editor-scroll-to-heading', handleScrollToHeadingEvent)

    return () => {
      window.removeEventListener('editor-format', handleFormatEvent)
      window.removeEventListener('editor-insert', handleInsertEvent)
      window.removeEventListener('editor-undo', handleUndoEvent)
      window.removeEventListener('editor-redo', handleRedoEvent)
      window.removeEventListener('editor-scroll-to-heading', handleScrollToHeadingEvent)
    }
  }, [])

  // store 内容 → 编辑器（外部变更：CM 编辑后切换模式、预览区 checkbox 切换等）
  useEffect(() => {
    // 仅在 wysiwyg 激活时同步，避免隐藏期间无谓的整篇重解析/序列化
    if (viewMode !== 'wysiwyg') return
    const editor = editorRef.current
    if (!editor) return
    if (content !== lastSerializedRef.current) {
      // flush=true：重建 EditorState，清掉旧文档残留的撤销历史
      editor.action(replaceAll(content, true))
      lastSerializedRef.current = editor.action(getMarkdown())
    }
  }, [content, viewMode])

  // 离开 wysiwyg 时冲刷一次序列化：listener 的 markdownUpdated 有 200ms 防抖，
  // 不冲刷会丢失最后一段输入（切换后回调因 viewMode 守卫被忽略）
  const prevViewModeRef = useRef(viewMode)
  useEffect(() => {
    const prev = prevViewModeRef.current
    prevViewModeRef.current = viewMode
    if (prev === 'wysiwyg' && viewMode !== 'wysiwyg') {
      const editor = editorRef.current
      if (!editor) return
      const markdown = editor.action(getMarkdown())
      // 仅在编辑器确有防抖窗口内未同步的编辑时才回写 store；
      // 否则可能是 store 刚被外部更新（同批次切换模式），回写会覆盖新内容
      if (markdown !== lastSerializedRef.current) {
        lastSerializedRef.current = markdown
        const store = useEditorStore.getState()
        if (markdown !== store.content) {
          store.setContent(markdown)
        }
      }
    }
  }, [viewMode])

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {createError && (
        <div className="p-4 text-sm text-[var(--text-secondary)]">
          {t('editor.loadFailed')}: {createError}
          <button
            className="ml-2 text-[var(--accent-color)] underline"
            onClick={() => {
              setCreateError(null)
              ensureEditor()
            }}
          >
            {t('editor.retry')}
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className="markdown-body wysiwyg-editor min-h-full"
        style={{ fontSize: `${(BASE_FONT_SIZE * zoomLevel) / 100}px` }}
      />
    </div>
  )
}
