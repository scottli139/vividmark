/**
 * 图表/图片全屏查看器纯逻辑测试：
 * 缩放数学（fit/clamp/滚轮锚点）、预览命中判定、原始尺寸读取
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fitScale,
  naturalSizeOf,
  resolveViewerTarget,
  viewerHtmlFromDiagram,
  zoomAtPoint,
} from '../diagramZoom'

describe('clampScale', () => {
  it('clamps to [MIN_SCALE, MAX_SCALE]', () => {
    expect(clampScale(1)).toBe(1)
    expect(clampScale(0.01)).toBe(MIN_SCALE)
    expect(clampScale(100)).toBe(MAX_SCALE)
  })
})

describe('fitScale', () => {
  it('shrinks large content to fit the viewport', () => {
    // 2000x1000 放进 900x600：受宽限制
    expect(fitScale(2000, 1000, 900, 600)).toBeCloseTo(0.45)
    // 受高限制
    expect(fitScale(1000, 2000, 900, 600)).toBeCloseTo(0.3)
  })

  it('keeps small content at 1:1 (never enlarges)', () => {
    expect(fitScale(100, 100, 900, 600)).toBe(1)
  })

  it('never goes below MIN_SCALE', () => {
    expect(fitScale(100000, 100000, 900, 600)).toBe(MIN_SCALE)
  })

  it('falls back to 1 for degenerate sizes', () => {
    expect(fitScale(0, 0, 900, 600)).toBe(1)
    expect(fitScale(100, 100, 0, 0)).toBe(1)
  })
})

describe('zoomAtPoint', () => {
  it('keeps the content point under the cursor stationary', () => {
    const p = { x: 120, y: -40 }
    const t = { x: 10, y: 25 }
    const oldScale = 1.5
    const newScale = 3
    const t2 = zoomAtPoint(p, t, oldScale, newScale)
    // 不变式：光标处内容坐标 c = (p - t)/s 缩放前后一致
    expect((p.x - t2.x) / newScale).toBeCloseTo((p.x - t.x) / oldScale)
    expect((p.y - t2.y) / newScale).toBeCloseTo((p.y - t.y) / oldScale)
  })

  it('anchored at origin keeps a centered image centered', () => {
    expect(zoomAtPoint({ x: 0, y: 0 }, { x: 0, y: 0 }, 1, 2)).toEqual({ x: 0, y: 0 })
  })
})

describe('viewerHtmlFromDiagram', () => {
  it('prefers inline svg', () => {
    const container = document.createElement('div')
    container.className = 'mermaid-diagram'
    container.innerHTML = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'
    expect(viewerHtmlFromDiagram(container)).toContain('<svg')
  })

  it('falls back to non-broken img (plantuml online fallback)', () => {
    const container = document.createElement('div')
    container.className = 'plantuml-diagram'
    container.innerHTML = '<img src="https://www.plantuml.com/plantuml/svg/abc" alt="PlantUML">'
    expect(viewerHtmlFromDiagram(container)).toContain('plantuml.com')
  })

  it('returns null for loading / error / broken-image states', () => {
    const loading = document.createElement('div')
    loading.innerHTML = '<div class="mermaid-loading"></div>'
    expect(viewerHtmlFromDiagram(loading)).toBeNull()

    const error = document.createElement('div')
    error.innerHTML = '<pre class="mermaid-error"><code>bad</code></pre>'
    expect(viewerHtmlFromDiagram(error)).toBeNull()

    const broken = document.createElement('div')
    broken.innerHTML = '<img class="plantuml-load-error" src="x">'
    expect(viewerHtmlFromDiagram(broken)).toBeNull()
  })
})

describe('resolveViewerTarget', () => {
  let host: HTMLElement | null = null

  afterEach(() => {
    host?.remove()
    host = null
  })

  /** 在 .markdown-body 宿主中构建预览 DOM */
  function setup(html: string): HTMLElement {
    host = document.createElement('div')
    host.className = 'markdown-body'
    host.innerHTML = html
    document.body.appendChild(host)
    return host
  }

  it('resolves clicks inside a mermaid diagram to its svg', () => {
    setup(
      '<div class="mermaid-diagram"><svg viewBox="0 0 10 10"><rect class="node" width="10" height="10"/></svg></div>'
    )
    const rect = host!.querySelector('rect')!
    const html = resolveViewerTarget(rect as unknown as HTMLElement)
    expect(html).toContain('<svg')
    expect(html).toContain('class="node"')
  })

  it('resolves plain markdown images', () => {
    setup('<p>text <img src="./a.png" alt="a"></p>')
    const img = host!.querySelector('img')!
    expect(resolveViewerTarget(img)).toBe(img.outerHTML)
  })

  it('returns null for loading-state diagrams and non-targets', () => {
    setup('<div class="mermaid-diagram"><div class="mermaid-loading"></div></div><p>plain</p>')
    expect(resolveViewerTarget(host!.querySelector('.mermaid-loading')!)).toBeNull()
    expect(resolveViewerTarget(host!.querySelector('p')!)).toBeNull()
  })

  it('returns null for images outside .markdown-body', () => {
    const outsider = document.createElement('img')
    outsider.src = 'https://example.com/x.png'
    document.body.appendChild(outsider)
    try {
      expect(resolveViewerTarget(outsider)).toBeNull()
    } finally {
      outsider.remove()
    }
  })
})

describe('naturalSizeOf', () => {
  it('reads svg size from viewBox', () => {
    const doc = document.createElement('div')
    doc.innerHTML = '<svg viewBox="-8 -8 344.5 118" width="100%"></svg>'
    const svg = doc.querySelector('svg')!
    expect(naturalSizeOf(svg)).toEqual({ width: 344.5, height: 118 })
  })

  it('reads svg size from numeric width/height attributes', () => {
    const doc = document.createElement('div')
    doc.innerHTML = '<svg width="916" height="352"></svg>'
    expect(naturalSizeOf(doc.querySelector('svg')!)).toEqual({ width: 916, height: 352 })
  })

  it('returns 0x0 for relative-sized svg without viewBox (jsdom has no layout)', () => {
    const doc = document.createElement('div')
    doc.innerHTML = '<svg width="100%"></svg>'
    expect(naturalSizeOf(doc.querySelector('svg')!)).toEqual({ width: 0, height: 0 })
  })

  it('reads img natural size', () => {
    const img = document.createElement('img')
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true })
    expect(naturalSizeOf(img)).toEqual({ width: 800, height: 600 })
  })

  it('returns 0x0 for not-yet-loaded images', () => {
    expect(naturalSizeOf(document.createElement('img'))).toEqual({ width: 0, height: 0 })
  })
})
