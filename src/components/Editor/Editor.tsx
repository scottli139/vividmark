import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { open } from '@tauri-apps/plugin-shell'
import type { EditorView } from '@codemirror/view'
import { useEditorStore } from '../../stores/editorStore'
import {
  parseMarkdownAsync,
  renderPlantUmlPlaceholders,
  renderMermaidPlaceholders,
} from '../../lib/markdown/parser'
import { exportCurrentDocument } from '../../lib/exportPdf'
import { openImageViewer, resolveViewerTarget } from '../../lib/diagramZoom'
import { scrollPreviewToHeading } from '../../lib/outlineUtils'
import { writeClipboardText } from '../../lib/clipboard'
import {
  buildPreviewMenuItems,
  getShortcutLabels,
  type PreviewMenuContext,
} from '../../lib/contextMenu'
import { isMacOS } from '../../lib/platform'
import { useContextMenu } from '../../hooks/useContextMenu'
import { ContextMenu } from '../Menu'
import { CodeMirrorEditor } from './CodeMirrorEditor'
import { WysiwygEditor } from './WysiwygEditor'
import '../../styles/globals.css'

export function Editor() {
  const { t } = useTranslation()
  const { content, setContent, viewMode, filePath, zoomLevel, isDarkMode } = useEditorStore()

  const [renderedHtml, setRenderedHtml] = useState('')
  const cmViewRef = useRef<EditorView | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  // 预览区右键菜单：打开时刻快照链接/图片落点与选区状态
  const { menu, openMenu, closeMenu } = useContextMenu<PreviewMenuContext>()

  const handlePreviewContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      const linkElement = target.closest('a[href]') as HTMLAnchorElement | null
      const imageElement = target.closest('img')
      const selection = window.getSelection()
      openMenu(e, {
        hasSelection: !!selection && !selection.isCollapsed && selection.toString().length > 0,
        linkHref: linkElement?.getAttribute('href') ?? undefined,
        imageSrc: imageElement?.getAttribute('src') ?? undefined,
      })
    },
    [openMenu]
  )

  const handlePreviewMenuSelect = useCallback(
    async (id: string) => {
      const data = menu?.data
      switch (id) {
        case 'copy': {
          const text = window.getSelection()?.toString()
          if (text) await writeClipboardText(text)
          break
        }
        case 'select-all': {
          const container = previewContainerRef.current
          const selection = window.getSelection()
          if (container && selection) {
            const range = document.createRange()
            range.selectNodeContents(container)
            selection.removeAllRanges()
            selection.addRange(range)
          }
          break
        }
        case 'export-pdf':
          // 同原生菜单 export-pdf：由下方监听器执行导出
          window.dispatchEvent(new CustomEvent('editor-export-pdf'))
          break
        case 'link:open':
          if (data?.linkHref) {
            try {
              await open(data.linkHref)
            } catch (error) {
              console.error('Failed to open external link:', error)
            }
          }
          break
        case 'link:copy':
          if (data?.linkHref) await writeClipboardText(data.linkHref)
          break
        case 'image:copy-src':
          if (data?.imageSrc) await writeClipboardText(data.imageSrc)
          break
      }
    },
    [menu]
  )

  // 全局快捷键监听（包括缩放）- 在 Preview 模式下也能使用
  // 使用 getState() 避免闭包问题
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      const store = useEditorStore.getState()

      // 缩放快捷键（浏览器 dev/E2E 路径；桌面端这些键由原生菜单 accelerator 拦截）
      // ⌘0 在桌面端是段落菜单的「正文」，浏览器无菜单占用故保留缩放重置；⇧⌘0 与桌面端一致
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
        const html = await parseMarkdownAsync(content, { baseDir })

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

  // PlantUML/Mermaid 占位符 → 本地渐进渲染（文本先出、SVG 后补）；
  // data-*-src 属性渲染后保留，主题切换时用新 dark 参数重跑即可。
  // 注意 viewMode 也必须在依赖里：预览容器只在 preview/split 模式挂载，
  // 从 WYSIWYG/Source 切过来时容器是新挂载的，renderedHtml 不变 effect 不会重跑
  useEffect(() => {
    const container = previewContainerRef.current
    if (!container) return
    void renderPlantUmlPlaceholders(container, { dark: isDarkMode })
    void renderMermaidPlaceholders(container, { dark: isDarkMode })
  }, [renderedHtml, isDarkMode, viewMode])

  // React 19 对 dangerouslySetInnerHTML 按对象 identity 比对决定是否重写 innerHTML——
  // 内联字面量每次渲染都是新对象，任何无关重渲染（缩放、光标移动等 store 订阅更新）
  // 都会把预览 DOM 重置回占位 HTML，渐进渲染出的图表 SVG 随之消失。memo 稳定 identity。
  const previewHtmlProp = useMemo(() => ({ __html: renderedHtml }), [renderedHtml])

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

  // 监听 PDF 导出请求事件（Typora 式：保存对话框 → 静默生成 PDF）
  useEffect(() => {
    const handleExportPdf = () => {
      exportCurrentDocument()
    }

    window.addEventListener('editor-export-pdf', handleExportPdf as EventListener)
    return () => {
      window.removeEventListener('editor-export-pdf', handleExportPdf as EventListener)
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

          // 页内锚点（脚注引用/回链 `#fn1`/`#fnref1` 等）：预览容器内滚动定位，不走出站
          if (href.startsWith('#')) {
            const id = decodeURIComponent(href.slice(1))
            const container = previewContainerRef.current
            // 逐元素比对 id，避开 CSS.escape 兼容性（jsdom）与选择器转义问题
            const anchor = container
              ? Array.from(container.querySelectorAll<HTMLElement>('[id]')).find(
                  (el) => el.id === id
                )
              : undefined
            anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
          }

          // 使用系统浏览器打开外部链接
          try {
            await open(href)
          } catch (error) {
            console.error('Failed to open external link:', error)
          }
        }
        return
      }

      // 图表/图片点击：打开全屏查看器（链接分支已先行 return，
      // mermaid 图内 <a> 与链接包裹的 img 不会走到这里）
      const viewerHtml = resolveViewerTarget(target)
      if (viewerHtml) {
        openImageViewer(viewerHtml)
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
          onContextMenu={handlePreviewContextMenu}
        >
          <div
            className="markdown-body min-h-full p-8 origin-top-left"
            style={{ zoom: `${zoomLevel}%` }}
            dangerouslySetInnerHTML={previewHtmlProp}
            onClick={handlePreviewClick}
          />
        </div>
      )}

      {/* 预览区右键菜单 */}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildPreviewMenuItems(t, getShortcutLabels(isMacOS()), menu.data)}
          onSelect={(id) => void handlePreviewMenuSelect(id)}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}
