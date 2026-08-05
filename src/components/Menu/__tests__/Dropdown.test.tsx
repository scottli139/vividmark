import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Dropdown } from '../Dropdown'
import type { MenuItem } from '../MenuPanel'

const baseItems: MenuItem[] = [
  { id: 'one', label: 'Item One' },
  { id: 'two', label: 'Item Two', shortcut: 'Cmd+2' },
]

function renderDropdown(props: Partial<Parameters<typeof Dropdown>[0]> = {}) {
  const onSelect = props.onSelect ?? vi.fn()
  render(
    <Dropdown
      items={baseItems}
      onSelect={onSelect}
      title="Menu Trigger"
      trigger={<span>trigger</span>}
      {...props}
    />
  )
  return { onSelect }
}

describe('Dropdown', () => {
  it('renders trigger with menu hidden initially', () => {
    renderDropdown()

    expect(screen.getByTitle('Menu Trigger')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens menu on trigger click and renders items with shortcut', () => {
    renderDropdown()

    fireEvent.click(screen.getByTitle('Menu Trigger'))

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('Item One')).toBeInTheDocument()
    expect(screen.getByText('Item Two')).toBeInTheDocument()
    expect(screen.getByText('Cmd+2')).toBeInTheDocument()
  })

  it('toggles closed when trigger is clicked again', () => {
    renderDropdown()

    const trigger = screen.getByTitle('Menu Trigger')
    fireEvent.click(trigger)
    fireEvent.click(trigger)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes on outside mousedown', () => {
    renderDropdown()

    fireEvent.click(screen.getByTitle('Menu Trigger'))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not close on mousedown inside the menu', () => {
    renderDropdown()

    fireEvent.click(screen.getByTitle('Menu Trigger'))
    fireEvent.mouseDown(screen.getByText('Item One'))

    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderDropdown()

    fireEvent.click(screen.getByTitle('Menu Trigger'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('calls onSelect with item id and closes after selection', () => {
    const { onSelect } = renderDropdown()

    fireEvent.click(screen.getByTitle('Menu Trigger'))
    fireEvent.click(screen.getByText('Item Two'))

    expect(onSelect).toHaveBeenCalledWith('two')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders checked item with check mark and aria-checked', () => {
    renderDropdown({
      items: [
        { id: 'a', label: 'Alpha', checked: true },
        { id: 'b', label: 'Beta', checked: false },
      ],
    })

    fireEvent.click(screen.getByTitle('Menu Trigger'))

    const checkedItem = screen.getByRole('menuitemcheckbox', { name: /Alpha/ })
    expect(checkedItem).toHaveAttribute('aria-checked', 'true')
    expect(checkedItem.textContent).toContain('✓')

    const uncheckedItem = screen.getByRole('menuitemcheckbox', { name: /Beta/ })
    expect(uncheckedItem).toHaveAttribute('aria-checked', 'false')
    expect(uncheckedItem.textContent).not.toContain('✓')
  })

  it('renders divider between items', () => {
    renderDropdown({
      items: [{ id: 'a', label: 'Alpha' }, { divider: true }, { id: 'b', label: 'Beta' }],
    })

    fireEvent.click(screen.getByTitle('Menu Trigger'))

    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('does not call onSelect for disabled item', () => {
    const { onSelect } = renderDropdown({
      items: [{ id: 'a', label: 'Alpha', disabled: true }],
    })

    fireEvent.click(screen.getByTitle('Menu Trigger'))
    fireEvent.click(screen.getByText('Alpha'))

    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('aligns panel left by default', () => {
    renderDropdown()

    fireEvent.click(screen.getByTitle('Menu Trigger'))

    expect(screen.getByRole('menu').className).toContain('left-0')
    expect(screen.getByRole('menu').className).not.toContain('right-0')
  })

  it('aligns panel right when align="right"', () => {
    renderDropdown({ align: 'right' })

    fireEvent.click(screen.getByTitle('Menu Trigger'))

    expect(screen.getByRole('menu').className).toContain('right-0')
    expect(screen.getByRole('menu').className).not.toContain('left-0')
  })

  it('applies widthClass to the panel', () => {
    renderDropdown({ widthClass: 'w-48' })

    fireEvent.click(screen.getByTitle('Menu Trigger'))

    expect(screen.getByRole('menu').className).toContain('w-48')
  })
})
