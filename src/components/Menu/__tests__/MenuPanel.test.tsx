import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MenuPanel } from '../MenuPanel'
import type { MenuItem } from '../MenuPanel'

const itemsWithSubmenu: MenuItem[] = [
  { id: 'cut', label: 'Cut' },
  { divider: true },
  {
    id: 'submenu:paragraph',
    label: 'Paragraph',
    children: [
      { id: 'block:paragraph', label: 'Normal' },
      { id: 'format:h1', label: 'Heading 1' },
    ],
  },
  {
    id: 'submenu:format',
    label: 'Format',
    children: [{ id: 'format:bold', label: 'Bold' }],
  },
]

describe('MenuPanel submenu', () => {
  it('renders submenu triggers without expanding children by default', () => {
    render(<MenuPanel items={itemsWithSubmenu} onSelect={vi.fn()} />)

    expect(screen.getByText('Paragraph')).toBeInTheDocument()
    expect(screen.getByText('Format')).toBeInTheDocument()
    // 子菜单项默认不渲染
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
    expect(screen.queryByText('Bold')).not.toBeInTheDocument()
  })

  it('expands children on hover and dispatches child selection', () => {
    const onSelect = vi.fn()
    render(<MenuPanel items={itemsWithSubmenu} onSelect={onSelect} />)

    fireEvent.mouseEnter(screen.getByText('Paragraph'))
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Heading 1')).toBeInTheDocument()
    // 另一个子菜单保持关闭
    expect(screen.queryByText('Bold')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Heading 1'))
    expect(onSelect).toHaveBeenCalledWith('format:h1')
  })

  it('switches open submenu when hovering another trigger; closes on plain item hover', () => {
    render(<MenuPanel items={itemsWithSubmenu} onSelect={vi.fn()} />)

    fireEvent.mouseEnter(screen.getByText('Paragraph'))
    expect(screen.getByText('Normal')).toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByText('Format'))
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
    expect(screen.getByText('Bold')).toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByText('Cut'))
    expect(screen.queryByText('Bold')).not.toBeInTheDocument()
  })

  it('collapses submenu when mouse leaves the panel', () => {
    render(<MenuPanel items={itemsWithSubmenu} onSelect={vi.fn()} />)

    fireEvent.mouseEnter(screen.getByText('Paragraph'))
    expect(screen.getByText('Normal')).toBeInTheDocument()

    fireEvent.mouseLeave(screen.getAllByRole('menu')[0])
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
  })

  it('clicking a submenu trigger does not dispatch its own id', () => {
    const onSelect = vi.fn()
    render(<MenuPanel items={itemsWithSubmenu} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Paragraph'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
