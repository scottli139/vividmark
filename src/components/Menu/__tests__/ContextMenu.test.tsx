import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu } from '../ContextMenu'
import { resolveContextMenuPosition } from '../menuPosition'
import type { MenuItem } from '../MenuPanel'

const baseItems: MenuItem[] = [
  { id: 'one', label: 'Item One' },
  { divider: true },
  { id: 'two', label: 'Item Two' },
]

function renderContextMenu(props: Partial<Parameters<typeof ContextMenu>[0]> = {}) {
  const onSelect = props.onSelect ?? vi.fn()
  const onClose = props.onClose ?? vi.fn()
  const utils = render(
    <ContextMenu
      x={100}
      y={50}
      items={baseItems}
      onSelect={onSelect}
      onClose={onClose}
      {...props}
    />
  )
  return { onSelect, onClose, ...utils }
}

describe('ContextMenu', () => {
  it('renders menu fixed at the given coordinates', () => {
    renderContextMenu()

    const wrapper = screen.getByRole('menu').parentElement as HTMLElement
    expect(wrapper.className).toContain('fixed')
    expect(wrapper.style.left).toBe('100px')
    expect(wrapper.style.top).toBe('50px')
    expect(screen.getByText('Item One')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('calls onSelect with item id and onClose after selection', () => {
    const { onSelect, onClose } = renderContextMenu()

    fireEvent.click(screen.getByText('Item Two'))

    expect(onSelect).toHaveBeenCalledWith('two')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on outside mousedown', () => {
    const { onClose } = renderContextMenu()

    fireEvent.mouseDown(document.body)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on mousedown inside the menu', () => {
    const { onClose } = renderContextMenu()

    fireEvent.mouseDown(screen.getByText('Item One'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape', () => {
    const { onClose } = renderContextMenu()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on window scroll', () => {
    const { onClose } = renderContextMenu()

    fireEvent.scroll(window)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on window resize', () => {
    const { onClose } = renderContextMenu()

    fireEvent.resize(window)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('resolveContextMenuPosition', () => {
  it('keeps coordinates when the menu fits in the viewport', () => {
    expect(resolveContextMenuPosition(100, 50, 160, 100, 1024, 768)).toEqual({
      left: 100,
      top: 50,
    })
  })

  it('flips left when overflowing the right edge', () => {
    expect(resolveContextMenuPosition(900, 50, 160, 100, 1024, 768)).toEqual({
      left: 740,
      top: 50,
    })
  })

  it('flips up when overflowing the bottom edge', () => {
    expect(resolveContextMenuPosition(100, 700, 160, 100, 1024, 768)).toEqual({
      left: 100,
      top: 600,
    })
  })

  it('clamps to 0 when flipping would leave the viewport', () => {
    expect(resolveContextMenuPosition(100, 50, 300, 200, 250, 150)).toEqual({ left: 0, top: 0 })
  })
})
