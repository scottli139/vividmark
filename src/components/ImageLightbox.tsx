import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IMAGE_VIEWER_EVENT,
  clampScale,
  fitScale,
  naturalSizeOf,
  zoomAtPoint,
} from '../lib/diagramZoom'

/** 查看器初始边距：内容适应 92% 宽 × 88% 高的视口区域 */
const VIEWPORT_FIT_RATIO_W = 0.92
const VIEWPORT_FIT_RATIO_H = 0.88
/** 按钮/键盘步进缩放倍率 */
const ZOOM_STEP = 1.25
/** 滚轮缩放倍率 */
const WHEEL_STEP = 1.2
/** 区分点击与拖拽的位移阈值（px）：超过则本次 click 不触发「点空白关闭」 */
const DRAG_THRESHOLD = 4
/** 内容卡片内边距（与 globals.css .image-lightbox-content 的 padding 一致；fit 计算需计入） */
const CONTENT_PADDING = 16

/**
 * 图表/图片全屏查看器（全局单例，挂 App.tsx）。
 * 打开：window dispatch CustomEvent('app-open-image-viewer', { detail: { html } })，
 * html 为 svg/img 的 outerHTML（见 lib/diagramZoom.ts 的命中判定）。
 *
 * 交互：滚轮以光标为锚点缩放、拖拽平移、双击/按钮/键盘 0 重置、
 * Esc 或点击空白关闭。缩放平移状态走 ref + 直写 DOM transform，
 * 避免滚轮/拖拽高频操作触发 React 重渲染；仅百分比显示走 state。
 */
export function ImageLightbox() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [scalePercent, setScalePercent] = useState(100)
  const [isDragging, setIsDragging] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const pendingHtmlRef = useRef('')
  const scaleRef = useRef(1)
  const translateRef = useRef({ x: 0, y: 0 })
  const naturalRef = useRef({ width: 0, height: 0 })
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null
  )
  /** 拖拽超过阈值后紧跟着的 click 不当作「点空白关闭」 */
  const justDraggedRef = useRef(false)
  /** 用户是否已手动缩放/平移（img 异步加载完成后仅未操作时才自动 refit） */
  const userDirtyRef = useRef(false)

  const applyTransform = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    el.style.transform = `translate(${translateRef.current.x}px, ${translateRef.current.y}px) scale(${scaleRef.current})`
  }, [])

  /** 按视口与原始尺寸计算 fit 缩放并复位平移 */
  const resetView = useCallback(() => {
    const viewport = viewportRef.current
    const vpW = (viewport?.clientWidth || window.innerWidth) * VIEWPORT_FIT_RATIO_W
    const vpH = (viewport?.clientHeight || window.innerHeight) * VIEWPORT_FIT_RATIO_H
    // 卡片内边距计入内容尺寸（0 尺寸回退路径加 32px 仍是 min(1,…) = 1，行为不变）
    const natW = naturalRef.current.width + CONTENT_PADDING * 2
    const natH = naturalRef.current.height + CONTENT_PADDING * 2
    scaleRef.current = fitScale(natW, natH, vpW, vpH)
    translateRef.current = { x: 0, y: 0 }
    userDirtyRef.current = false
    applyTransform()
    setScalePercent(Math.round(scaleRef.current * 100))
  }, [applyTransform])

  const zoomBy = useCallback(
    (factor: number) => {
      const next = clampScale(scaleRef.current * factor)
      if (next === scaleRef.current) return
      // 按钮/键盘缩放以视口中心为锚点（原点即中心）
      translateRef.current = zoomAtPoint(
        { x: 0, y: 0 },
        translateRef.current,
        scaleRef.current,
        next
      )
      scaleRef.current = next
      userDirtyRef.current = true
      applyTransform()
      setScalePercent(Math.round(next * 100))
    },
    [applyTransform]
  )

  const close = useCallback(() => setIsOpen(false), [])

  // 监听打开事件
  useEffect(() => {
    const handler = (e: Event) => {
      const html = (e as CustomEvent<{ html?: string }>).detail?.html
      if (!html) return
      pendingHtmlRef.current = html
      setIsOpen(true)
    }
    window.addEventListener(IMAGE_VIEWER_EVENT, handler)
    return () => window.removeEventListener(IMAGE_VIEWER_EVENT, handler)
  }, [])

  // 打开后：注入内容、解除预览尺寸约束、按原始尺寸 fit；关闭时清空
  useEffect(() => {
    const content = contentRef.current
    if (!isOpen || !content) return

    content.innerHTML = pendingHtmlRef.current
    const target = content.firstElementChild
    if (target instanceof SVGSVGElement) {
      target.removeAttribute('width')
      target.removeAttribute('height')
      target.style.maxWidth = 'none'
      naturalRef.current = naturalSizeOf(target)
      if (naturalRef.current.width > 0) {
        target.style.width = `${naturalRef.current.width}px`
        target.style.height = `${naturalRef.current.height}px`
      }
    } else if (target instanceof HTMLImageElement) {
      target.style.maxWidth = 'none'
      const readNatural = () => {
        naturalRef.current = naturalSizeOf(target)
        if (!userDirtyRef.current) resetView()
      }
      if (target.complete && target.naturalWidth > 0) {
        readNatural()
      } else {
        target.addEventListener('load', readNatural, { once: true })
      }
    } else {
      naturalRef.current = { width: 0, height: 0 }
    }

    resetView()
    // 焦点移到遮罩：键盘交互（Esc/+/-/0）不落入背景编辑器
    overlayRef.current?.focus()

    return () => {
      content.innerHTML = ''
    }
  }, [isOpen, resetView])

  // 滚轮缩放（光标锚点）：必须 passive: false 才能 preventDefault
  useEffect(() => {
    if (!isOpen) return
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const p = {
        x: e.clientX - (rect.left + rect.width / 2),
        y: e.clientY - (rect.top + rect.height / 2),
      }
      const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP
      const next = clampScale(scaleRef.current * factor)
      if (next === scaleRef.current) return
      translateRef.current = zoomAtPoint(p, translateRef.current, scaleRef.current, next)
      scaleRef.current = next
      userDirtyRef.current = true
      applyTransform()
      setScalePercent(Math.round(next * 100))
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [isOpen, applyTransform])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: translateRef.current.x,
      baseY: translateRef.current.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!isDragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) setIsDragging(true)
    translateRef.current = { x: drag.baseX + dx, y: drag.baseY + dy }
    userDirtyRef.current = true
    applyTransform()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (isDragging) {
      justDraggedRef.current = true
      setIsDragging(false)
    }
  }

  /** 点击空白区域关闭；点在内容上不动；拖拽后的 click 忽略 */
  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false
      return
    }
    if (e.target === viewportRef.current) close()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomBy(ZOOM_STEP)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomBy(1 / ZOOM_STEP)
    } else if (e.key === '0') {
      e.preventDefault()
      resetView()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className={`image-lightbox${isDragging ? ' dragging' : ''}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={viewportRef}
        className="image-lightbox-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleViewportClick}
        onDoubleClick={resetView}
      >
        <div ref={contentRef} className="image-lightbox-content" />
      </div>

      <div className="image-lightbox-toolbar">
        <span className="image-lightbox-scale">{scalePercent}%</span>
        <button
          type="button"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          title={t('imageViewer.zoomOut')}
          aria-label={t('imageViewer.zoomOut')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.5-4.5M8 11h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          title={t('imageViewer.zoomIn')}
          aria-label={t('imageViewer.zoomIn')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.5-4.5M11 8v6M8 11h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={resetView}
          title={t('imageViewer.reset')}
          aria-label={t('imageViewer.reset')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 2.6-6.3L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={close}
          title={t('imageViewer.close')}
          aria-label={t('imageViewer.close')}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
