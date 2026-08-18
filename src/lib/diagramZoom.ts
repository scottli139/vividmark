/**
 * 图表/图片全屏查看器（ImageLightbox）的纯逻辑：
 * 缩放数学（fit/clamp/滚轮锚点）、预览 DOM 命中判定、注入元素原始尺寸读取。
 * 全部纯函数或 DOM 只读，可单测。
 */

/** 打开查看器的全局事件（CustomEvent bus 约定，detail: { html }） */
export const IMAGE_VIEWER_EVENT = 'app-open-image-viewer'

/** dispatch 打开查看器（预览点击 / WYSIWYG nodeview 按钮共用入口） */
export function openImageViewer(html: string) {
  window.dispatchEvent(new CustomEvent(IMAGE_VIEWER_EVENT, { detail: { html } }))
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 8

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** 适应视口的初始缩放：大图缩进视口，小图 1:1 不放大 */
export function fitScale(natW: number, natH: number, vpW: number, vpH: number): number {
  if (natW <= 0 || natH <= 0 || vpW <= 0 || vpH <= 0) return 1
  return clampScale(Math.min(1, vpW / natW, vpH / natH))
}

export interface Point {
  x: number
  y: number
}

/**
 * 滚轮缩放锚点：以光标位置为不动点更新平移量。
 * 坐标系约定：视口中心为原点，内容 transform = translate(t) scale(s)、origin center。
 * 光标相对中心 p 处的内容坐标 c = (p - t) / s；缩放后仍落在 p：
 * t' = p - c · s' = p - (p - t) · (s' / s)
 */
export function zoomAtPoint(p: Point, t: Point, oldScale: number, newScale: number): Point {
  const ratio = newScale / oldScale
  return {
    x: p.x - (p.x - t.x) * ratio,
    y: p.y - (p.y - t.y) * ratio,
  }
}

const DIAGRAM_SELECTOR = '.mermaid-diagram, .plantuml-diagram'

/**
 * 从图表容器提取可查看内容的 outerHTML：
 * 优先内联 svg（本地离线渲染）；无 svg 取未破图 img（PlantUML 在线回退态）；
 * loading（仅有占位 div）/error（.mermaid-error、破图）态返回 null。
 */
export function viewerHtmlFromDiagram(container: HTMLElement): string | null {
  const svg = container.querySelector('svg')
  if (svg) return svg.outerHTML
  const img = container.querySelector('img')
  if (img && !img.classList.contains('plantuml-load-error')) return img.outerHTML
  return null
}

/**
 * 预览点击命中判定：返回可放大查看元素的 outerHTML，无命中返回 null。
 * 调用方需保证链接分支已先行处理（mermaid 图内 <a>、链接包裹的 img 不会走到这里）。
 *
 * 1. 图表容器（.mermaid-diagram/.plantuml-diagram）→ viewerHtmlFromDiagram
 * 2. .markdown-body 内的普通 img → outerHTML
 */
export function resolveViewerTarget(target: HTMLElement): string | null {
  const diagram = target.closest<HTMLElement>(DIAGRAM_SELECTOR)
  if (diagram) return viewerHtmlFromDiagram(diagram)
  const img = target.closest('img')
  if (img && img.closest('.markdown-body')) return img.outerHTML
  return null
}

export interface NaturalSize {
  width: number
  height: number
}

/**
 * 读取注入查看器元素的原始像素尺寸（用于解除预览尺寸约束、显式布局与 fit 计算）：
 * - svg：viewBox 宽高 → width/height 属性数值（跳过 "100%" 等相对值）→ getBBox 兜底
 * - img：naturalWidth/naturalHeight（未加载完成时为 0，调用方自行等 load 后重读）
 * 全部失败返回 {0,0}，调用方按 1:1 处理。jsdom 无 SVG 布局，getBBox 路径有 try 兜底。
 */
export function naturalSizeOf(el: Element): NaturalSize {
  if (el instanceof SVGSVGElement) {
    const viewBox = el.getAttribute('viewBox')
    if (viewBox) {
      const parts = viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number)
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { width: parts[2], height: parts[3] }
      }
    }
    const w = parseFloat(el.getAttribute('width') ?? '')
    const h = parseFloat(el.getAttribute('height') ?? '')
    if (w > 0 && h > 0) return { width: w, height: h }
    try {
      const box = el.getBBox()
      if (box.width > 0 && box.height > 0) return { width: box.width, height: box.height }
    } catch {
      // jsdom 等元素未渲染环境无布局，忽略走 {0,0}
    }
  } else if (el instanceof HTMLImageElement) {
    if (el.naturalWidth > 0 && el.naturalHeight > 0) {
      return { width: el.naturalWidth, height: el.naturalHeight }
    }
  }
  return { width: 0, height: 0 }
}
