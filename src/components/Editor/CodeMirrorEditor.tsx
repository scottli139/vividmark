import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  redoDepth,
  undo,
  undoDepth,
} from '@codemirror/commands'
import { markdown, markdownKeymap } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { search, searchKeymap, openSearchPanel } from '@codemirror/search'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { useEditorStore } from '../../stores/editorStore'
import { formatTransaction, insertTextAtCursor, type FormatType } from '../../lib/markdownEditing'
import { createImageMarkdownFromFile } from '../../lib/imageUtils'
import { readClipboardText, writeClipboardText } from '../../lib/clipboard'
import { buildSourceMenuItems, getShortcutLabels } from '../../lib/contextMenu'
import { isMacOS } from '../../lib/platform'
import { useContextMenu } from '../../hooks/useContextMenu'
import { ContextMenu } from '../Menu'

/** 基础字号（对应原 textarea 的 text-sm），随 zoomLevel 缩放 */
const BASE_FONT_SIZE = 14
/** 大纲跳转时目标位置距滚动容器顶部的边距（px） */
const SCROLL_TOP_MARGIN = 72

/** 布局/配色主题：亮暗共用，背景与文本色对齐 --editor-bg / --editor-text */
function buildThemeExtensions(isDark: boolean): Extension {
  const layoutTheme = EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'var(--editor-bg)',
        color: 'var(--editor-text)',
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      },
      '.cm-content': {
        padding: '2rem',
        caretColor: 'var(--editor-text)',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--editor-text)',
      },
      '.cm-panels': {
        backgroundColor: 'var(--toolbar-bg)',
        color: 'var(--editor-text)',
      },
    },
    isDark ? { dark: true } : {}
  )
  // 暗色：oneDark 在前，布局主题在后以覆盖其编辑器背景
  if (isDark) {
    return [oneDark, layoutTheme]
  }
  return [layoutTheme, syntaxHighlighting(defaultHighlightStyle, { fallback: true })]
}

/** 字号主题：zoomLevel 50–200 → 7–28px */
function buildFontSizeTheme(zoomLevel: number): Extension {
  return EditorView.theme({
    '.cm-content': { fontSize: `${(BASE_FONT_SIZE * zoomLevel) / 100}px` },
  })
}

/** 行内/块级格式化（工具栏 editor-format 事件与快捷键共用） */
function runFormat(view: EditorView, format: FormatType): boolean {
  view.dispatch(formatTransaction(view.state, format))
  return true
}

/** 格式快捷键：tooltip 宣称的 Mod-B/I/K/1/2/3 */
const formatKeymap = Prec.highest(
  keymap.of([
    { key: 'Mod-b', run: (view) => runFormat(view, 'bold') },
    { key: 'Mod-i', run: (view) => runFormat(view, 'italic') },
    { key: 'Mod-k', run: (view) => runFormat(view, 'link') },
    { key: 'Mod-1', run: (view) => runFormat(view, 'h1') },
    { key: 'Mod-2', run: (view) => runFormat(view, 'h2') },
    { key: 'Mod-3', run: (view) => runFormat(view, 'h3') },
  ])
)

// defaultKeymap 的 Mod-/ 是 toggleComment（会把当前行/选区注释成 <!-- -->），
// 与应用的「Cmd+/ 切换 WYSIWYG⇄Source」冲突——移除该绑定（模式切换由
// useKeyboardShortcuts 的 window 级监听负责，CM 不拦截传播，两个监听都能收到）
const appDefaultKeymap = defaultKeymap.filter((binding) => binding.key !== 'Mod-/')

/** CM 编辑 → store 同步；撤销深度与光标位置上报 */
const syncUpdateListener = EditorView.updateListener.of((update) => {
  const store = useEditorStore.getState()

  if (update.docChanged) {
    const value = update.state.doc.toString()
    // 与 store 相同则跳过（避免自己写入又回灌的回环）
    if (value !== store.content) {
      store.setContent(value)
    }
  }

  if (update.docChanged || update.selectionSet) {
    const head = update.state.selection.main.head
    const line = update.state.doc.lineAt(head)
    const col = head - line.from + 1
    if (line.number !== store.cursorLine || col !== store.cursorCol) {
      store.setCursorPosition(line.number, col)
    }
  }

  // canUndo/canRedo 按 viewMode 分流：wysiwyg 激活时由 Milkdown 侧
  // （wysiwygHistoryPlugin）上报，隐藏中的 CM 不得覆写
  if (store.viewMode !== 'source' && store.viewMode !== 'split') return
  const nextCanUndo = undoDepth(update.state) > 0
  const nextCanRedo = redoDepth(update.state) > 0
  if (nextCanUndo !== store.canUndo) store.setCanUndo(nextCanUndo)
  if (nextCanRedo !== store.canRedo) store.setCanRedo(nextCanRedo)
})

/** 粘贴/拖拽的图片写入 assets（或回退 base64）后插入 Markdown 图片语法 */
async function insertImageFiles(view: EditorView, files: File[]): Promise<void> {
  const docPath = useEditorStore.getState().filePath
  for (const file of files) {
    const markdown = await createImageMarkdownFromFile(file, docPath)
    if (markdown) {
      view.dispatch(insertTextAtCursor(view.state, markdown))
    }
  }
  view.focus()
}

function pickImageFiles(fileList: FileList | null | undefined): File[] {
  return Array.from(fileList ?? []).filter((f) => f.type.startsWith('image/'))
}

/** 图片粘贴/拖拽；无图片时放行默认行为 */
const imageEventHandlers = EditorView.domEventHandlers({
  paste(event, view) {
    const files = pickImageFiles(event.clipboardData?.files)
    if (files.length === 0) return
    event.preventDefault()
    void insertImageFiles(view, files)
  },
  drop(event, view) {
    const files = pickImageFiles(event.dataTransfer?.files)
    if (files.length === 0) return
    event.preventDefault()
    // 光标移动到拖放位置
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos !== null) {
      view.dispatch({ selection: { anchor: pos } })
    }
    void insertImageFiles(view, files)
  },
})

/** 大纲跳转：选中目标字符位置并平滑滚动（带上边距） */
function scrollToCharIndex(view: EditorView, charIndex: number): void {
  const pos = Math.max(0, Math.min(charIndex, view.state.doc.length))
  view.dispatch({ selection: { anchor: pos } })
  requestAnimationFrame(() => {
    const coords = view.coordsAtPos(pos)
    if (!coords) return
    const scroller = view.scrollDOM
    const target = scroller.scrollTop + coords.top - scroller.getBoundingClientRect().top
    scroller.scrollTo({ top: Math.max(0, target - SCROLL_TOP_MARGIN), behavior: 'smooth' })
  })
  view.focus()
}

interface CodeMirrorEditorProps {
  /** Split 模式滚动同步（Source → Preview），参数为 CM 滚动容器 */
  onScroll?: (scroller: HTMLElement) => void
  /** 向父组件暴露 EditorView（滚动同步需要访问 scrollDOM） */
  viewRef?: React.RefObject<EditorView | null>
}

/**
 * CodeMirror 6 Markdown 编辑器
 *
 * 替代原裸 textarea（Source/Split 模式）。组件常驻挂载（预览模式下隐藏），
 * 以保留撤销历史与事件处理能力；filePath 变化时重建视图以清空历史。
 */
export function CodeMirrorEditor({ onScroll, viewRef }: CodeMirrorEditorProps) {
  const filePath = useEditorStore((state) => state.filePath)
  // 以 filePath 为 key：打开新文件时重建编辑器，自然清空 CM 撤销历史
  return <CodeMirrorEditorView key={filePath ?? 'untitled'} onScroll={onScroll} viewRef={viewRef} />
}

function CodeMirrorEditorView({ onScroll, viewRef }: CodeMirrorEditorProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const compartmentsRef = useRef({ theme: new Compartment(), fontSize: new Compartment() })

  const isDarkMode = useEditorStore((state) => state.isDarkMode)
  const zoomLevel = useEditorStore((state) => state.zoomLevel)
  const content = useEditorStore((state) => state.content)
  const canUndo = useEditorStore((state) => state.canUndo)
  const canRedo = useEditorStore((state) => state.canRedo)

  // 右键菜单（Source/Split 下容器可见，非激活模式 contextmenu 不会触发）
  const { menu, openMenu, closeMenu } = useContextMenu<{ hasSelection: boolean }>()

  /** 右键 mousedown 时的 CM 选区快照（Chromium 下右键派 mousedown；WKWebView 不派发） */
  const rightClickSelRef = useRef<{ anchor: number; head: number } | null>(null)

  /**
   * 选区史（WKWebView 右键抢选对策，同 WysiwygEditor）：WKWebView 右键手势不派
   * mousedown，抢选可能早于任何 JS 事件落地——唯一可信来源是持续跟踪的上一个选区
   * （cur/prev 双缓冲 + doc 身份校验）。
   */
  const selHistRef = useRef<{
    prev: { from: number; to: number } | null
    cur: { from: number; to: number } | null
    doc: unknown | null
  }>({ prev: null, cur: null, doc: null })

  useEffect(() => {
    const track = () => {
      const view = editorViewRef.current
      if (!view) return
      const sel = view.state.selection.main
      const hist = selHistRef.current
      const range = sel.empty ? null : { from: sel.from, to: sel.to }
      // doc 身份变化（编辑/重载）时整段历史作废，避免旧位置落回新文档
      const doc = view.state.doc
      if (hist.doc !== doc) {
        hist.prev = null
        hist.cur = null
        hist.doc = doc
      }
      const changed = range?.from !== hist.cur?.from || range?.to !== hist.cur?.to
      if (changed) {
        hist.prev = hist.cur
        hist.cur = range
      }
    }
    document.addEventListener('selectionchange', track)
    return () => document.removeEventListener('selectionchange', track)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2) return
    const view = editorViewRef.current
    if (!view) return
    const { anchor, head } = view.state.selection.main
    rightClickSelRef.current = { anchor, head }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    const view = editorViewRef.current
    if (!view) return
    // WebKit/WKWebView 右键抢选污染对策（同 WysiwygEditor）：候选选区取
    // mousedown 快照 / 当前 / 选区史，严格包含（pos < to）排除「head 被压到
    // 右键点」的污染选区；落点在选区外时光标落到右键位置，并把 DOM 选择压回光标
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY })
    const snapshot = rightClickSelRef.current
    rightClickSelRef.current = null
    const { from, to } = view.state.selection.main
    const candidates: { from: number; to: number }[] = []
    if (snapshot && snapshot.anchor !== snapshot.head) {
      candidates.push({
        from: Math.min(snapshot.anchor, snapshot.head),
        to: Math.max(snapshot.anchor, snapshot.head),
      })
    }
    if (from < to) candidates.push({ from, to })
    const hist = selHistRef.current
    if (hist.doc === view.state.doc) {
      if (hist.cur) candidates.push(hist.cur)
      if (hist.prev) candidates.push(hist.prev)
    }
    const target =
      pos !== null && candidates.find((c) => c.from < c.to && pos >= c.from && pos < c.to)
    if (pos !== null && target) {
      if (from !== target.from || to !== target.to) {
        view.dispatch({ selection: { anchor: target.from, head: target.to } })
      }
      try {
        const anchorPos = view.domAtPos(target.from)
        const headPos = view.domAtPos(target.to)
        window
          .getSelection()
          ?.setBaseAndExtent(anchorPos.node, anchorPos.offset, headPos.node, headPos.offset)
      } catch {
        // domAtPos 在极端位置可能抛错；忽略，CM 侧选区仍正确
      }
    } else if (pos !== null && (from === to || pos < from || pos > to)) {
      view.dispatch({ selection: { anchor: pos } })
      try {
        const domPos = view.domAtPos(view.state.selection.main.head)
        window.getSelection()?.collapse(domPos.node, domPos.offset)
      } catch {
        // domAtPos 在极端位置可能抛错；忽略，CM 侧选区仍正确
      }
    }
    openMenu(e, { hasSelection: !view.state.selection.main.empty })
    // 菜单打开期间的选区锚点：守卫据此把 DOM/CM 选区锁回（见下方 useEffect）
    menuSelRangeRef.current = view.state.selection.main.empty
      ? null
      : { from: view.state.selection.main.from, to: view.state.selection.main.to }
  }

  /** 菜单打开时的选区锚点（选区守卫的目标） */
  const menuSelRangeRef = useRef<{ from: number; to: number } | null>(null)

  // 选区守卫（WKWebView 专属对策，同 WysiwygEditor）：WebKit 抢选可能迟于
  // contextmenu 落地，点击菜单项也会坍缩 DOM 选择——菜单打开期间任何
  // selectionchange 都把 DOM/CM 选区锁回打开时刻的锚点；任一 mousedown 后停止干预
  useEffect(() => {
    if (!menu) return
    const range = menuSelRangeRef.current
    if (!range) return
    let active = true
    const forceSelection = () => {
      if (!active) return
      const view = editorViewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      if (from !== range.from || to !== range.to) {
        view.dispatch({ selection: { anchor: range.from, head: range.to } })
      }
      try {
        const anchor = view.domAtPos(range.from)
        const head = view.domAtPos(range.to)
        window.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, head.node, head.offset)
      } catch {
        // domAtPos 在极端位置可能抛错；忽略
      }
    }
    const deactivate = () => {
      active = false
    }
    document.addEventListener('selectionchange', forceSelection)
    document.addEventListener('mousedown', deactivate, true)
    return () => {
      active = false
      document.removeEventListener('selectionchange', forceSelection)
      document.removeEventListener('mousedown', deactivate, true)
    }
  }, [menu])

  const handleMenuSelect = (id: string) => {
    const view = editorViewRef.current
    if (!view) return

    if (id.startsWith('format:')) {
      runFormat(view, id.slice('format:'.length) as FormatType)
    } else if (id === 'undo') {
      undo(view)
    } else if (id === 'redo') {
      redo(view)
    } else if (id === 'cut' || id === 'copy') {
      const { from, to, empty } = view.state.selection.main
      if (!empty) {
        void writeClipboardText(view.state.sliceDoc(from, to))
        if (id === 'cut') view.dispatch(view.state.replaceSelection(''))
      }
    } else if (id === 'paste') {
      // 异步读取系统剪贴板（桌面端走 clipboard-manager 插件）
      void readClipboardText().then((text) => {
        if (text) {
          view.dispatch(view.state.replaceSelection(text))
          view.focus()
        }
      })
      return
    } else if (id === 'select-all') {
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
    } else if (id === 'find') {
      openSearchPanel(view)
    }
    view.focus()
  }

  const onScrollRef = useRef(onScroll)
  useEffect(() => {
    onScrollRef.current = onScroll
  }, [onScroll])

  // 创建 EditorView（仅挂载一次；StrictMode 下经 cleanup 重建）
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const store = useEditorStore.getState()
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: store.content,
        extensions: [
          formatKeymap,
          history(),
          markdown({ codeLanguages: languages }),
          closeBrackets(),
          search({ top: true }),
          EditorView.lineWrapping,
          compartmentsRef.current.theme.of(buildThemeExtensions(store.isDarkMode)),
          compartmentsRef.current.fontSize.of(buildFontSizeTheme(store.zoomLevel)),
          syncUpdateListener,
          imageEventHandlers,
          keymap.of([
            ...closeBracketsKeymap,
            ...markdownKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...appDefaultKeymap,
            indentWithTab,
          ]),
        ],
      }),
    })
    editorViewRef.current = view
    if (viewRef) viewRef.current = view
    // 新视图历史为空，重置撤销/重做与光标状态
    store.setCanUndo(false)
    store.setCanRedo(false)
    store.setCursorPosition(1, 1)

    // Split 模式滚动同步
    const scroller = view.scrollDOM
    const handleScroll = () => onScrollRef.current?.(scroller)
    scroller.addEventListener('scroll', handleScroll)

    // window 事件总线（工具栏按钮、大纲跳转）
    // viewMode 分流：仅 source/split 激活时响应（wysiwyg 由 WysiwygEditor 处理）
    const isActive = () => {
      const mode = useEditorStore.getState().viewMode
      return mode === 'source' || mode === 'split'
    }
    const focusIfEditing = () => {
      if (isActive()) view.focus()
    }
    const handleFormatEvent = (e: Event) => {
      if (!isActive()) return
      const { format } = (e as CustomEvent<{ format: FormatType }>).detail
      runFormat(view, format)
      focusIfEditing()
    }
    const handleInsertEvent = (e: Event) => {
      if (!isActive()) return
      const { text } = (e as CustomEvent<{ text: string }>).detail
      view.dispatch(insertTextAtCursor(view.state, text))
      focusIfEditing()
    }
    const handleUndoEvent = () => {
      if (!isActive()) return
      undo(view)
      focusIfEditing()
    }
    const handleRedoEvent = () => {
      if (!isActive()) return
      redo(view)
      focusIfEditing()
    }
    const handleScrollToHeadingEvent = (e: Event) => {
      const mode = useEditorStore.getState().viewMode
      if (mode !== 'source' && mode !== 'split') return
      const { charIndex } = (e as CustomEvent<{ charIndex: number }>).detail
      scrollToCharIndex(view, charIndex)
    }
    // 原生菜单 Find（WYSIWYG 下无查找面板，事件不响应 —— 已知限制）
    const handleFindEvent = () => {
      if (!isActive()) return
      openSearchPanel(view)
      focusIfEditing()
    }

    window.addEventListener('editor-format', handleFormatEvent)
    window.addEventListener('editor-insert', handleInsertEvent)
    window.addEventListener('editor-undo', handleUndoEvent)
    window.addEventListener('editor-redo', handleRedoEvent)
    window.addEventListener('editor-scroll-to-heading', handleScrollToHeadingEvent)
    window.addEventListener('editor-find', handleFindEvent)

    return () => {
      scroller.removeEventListener('scroll', handleScroll)
      window.removeEventListener('editor-format', handleFormatEvent)
      window.removeEventListener('editor-insert', handleInsertEvent)
      window.removeEventListener('editor-undo', handleUndoEvent)
      window.removeEventListener('editor-redo', handleRedoEvent)
      window.removeEventListener('editor-scroll-to-heading', handleScrollToHeadingEvent)
      window.removeEventListener('editor-find', handleFindEvent)
      view.destroy()
      editorViewRef.current = null
      if (viewRef) viewRef.current = null
    }
  }, [viewRef])

  // 亮/暗主题切换
  useEffect(() => {
    const view = editorViewRef.current
    if (!view) return
    view.dispatch({
      effects: compartmentsRef.current.theme.reconfigure(buildThemeExtensions(isDarkMode)),
    })
  }, [isDarkMode])

  // 字号随 zoomLevel 缩放
  useEffect(() => {
    const view = editorViewRef.current
    if (!view) return
    view.dispatch({
      effects: compartmentsRef.current.fontSize.reconfigure(buildFontSizeTheme(zoomLevel)),
    })
  }, [zoomLevel])

  // store 内容 → CM（外部变更：打开文件、预览区 checkbox 切换等）
  useEffect(() => {
    const view = editorViewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (content !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: content } })
    }
  }, [content])

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden"
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
      />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildSourceMenuItems(t, getShortcutLabels(isMacOS()), {
            canUndo,
            canRedo,
            hasSelection: menu.data.hasSelection,
          })}
          onSelect={handleMenuSelect}
          onClose={closeMenu}
        />
      )}
    </>
  )
}
