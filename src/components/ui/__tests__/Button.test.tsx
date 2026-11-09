import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
  it('defaults to a non-submit button and handles clicks', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('bg-accent', 'text-on-accent')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('supports variants, sizes, and disabled state', () => {
    render(
      <Button variant="secondary" size="icon" disabled aria-label="Add">
        +
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Add' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('border-border', 'w-[var(--control-height-md)]')
  })
})
