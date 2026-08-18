/**
 * ImageLightbox 组件测试：事件打开/注入、关闭路径、缩放交互。
 * jsdom 无布局：viewport clientWidth 为 0，组件回退 window.innerWidth（1024x768）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ImageLightbox } from '../ImageLightbox'
import { IMAGE_VIEWER_EVENT } from '../../lib/diagramZoom'

const SVG_HTML =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%"><rect width="400" height="300"/></svg>'

function openViewer(html: string) {
  act(() => {
    window.dispatchEvent(new CustomEvent(IMAGE_VIEWER_EVENT, { detail: { html } }))
  })
}

function contentEl(): HTMLElement {
  return document.querySelector('.image-lightbox-content') as HTMLElement
}

afterEach(cleanup)

describe('ImageLightbox', () => {
  it('renders nothing until the open event arrives', () => {
    const { container } = render(<ImageLightbox />)
    expect(container).toBeEmptyDOMElement()
    openViewer(SVG_HTML)
    expect(document.querySelector('.image-lightbox')).toBeInTheDocument()
  })

  it('injects svg, sets explicit pixel size, and starts at fit scale (1:1 for small svg)', () => {
    render(<ImageLightbox />)
    openViewer(SVG_HTML)

    const svg = contentEl().querySelector('svg')!
    expect(svg.style.width).toBe('400px')
    expect(svg.style.height).toBe('300px')
    expect(svg.style.maxWidth).toBe('none')
    expect(contentEl().style.transform).toBe('translate(0px, 0px) scale(1)')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('closes via close button, Escape, and backdrop click; content click keeps it open', () => {
    render(<ImageLightbox />)

    // 关闭按钮
    openViewer(SVG_HTML)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.querySelector('.image-lightbox')).not.toBeInTheDocument()

    // Esc
    openViewer(SVG_HTML)
    fireEvent.keyDown(document.querySelector('.image-lightbox')!, { key: 'Escape' })
    expect(document.querySelector('.image-lightbox')).not.toBeInTheDocument()

    // 点内容不关闭；点空白关闭
    openViewer(SVG_HTML)
    fireEvent.click(contentEl())
    expect(document.querySelector('.image-lightbox')).toBeInTheDocument()
    fireEvent.click(document.querySelector('.image-lightbox-viewport')!)
    expect(document.querySelector('.image-lightbox')).not.toBeInTheDocument()
  })

  it('zoom buttons scale around center and reset restores fit', () => {
    render(<ImageLightbox />)
    openViewer(SVG_HTML)

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(contentEl().style.transform).toBe('translate(0px, 0px) scale(1.25)')
    expect(screen.getByText('125%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByText('100%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }))
    expect(contentEl().style.transform).toBe('translate(0px, 0px) scale(1)')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('keyboard +/- zoom and 0 reset work on the overlay', () => {
    render(<ImageLightbox />)
    openViewer(SVG_HTML)
    const overlay = document.querySelector('.image-lightbox')!

    fireEvent.keyDown(overlay, { key: '+' })
    expect(screen.getByText('125%')).toBeInTheDocument()
    fireEvent.keyDown(overlay, { key: '-' })
    expect(screen.getByText('100%')).toBeInTheDocument()
    fireEvent.keyDown(overlay, { key: '+' })
    fireEvent.keyDown(overlay, { key: '0' })
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shrinks oversized images to fit once natural size is known (load event)', () => {
    render(<ImageLightbox />)
    openViewer('<img src="https://example.com/big.png" alt="big">')

    const img = contentEl().querySelector('img')!
    // 注入时 jsdom 里 img 未加载：先 1:1
    expect(screen.getByText('100%')).toBeInTheDocument()

    Object.defineProperty(img, 'naturalWidth', { value: 4000, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 3000, configurable: true })
    fireEvent.load(img)

    // fit 受高限制（卡片 padding 计入内容尺寸）：0.88 × 768 / (3000 + 32) = 0.2229…
    expect(contentEl().style.transform).toContain('scale(0.2229')
    expect(screen.getByText('22%')).toBeInTheDocument()
  })
})
