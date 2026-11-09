import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TextField } from '../TextField'

describe('TextField', () => {
  it('forwards input behavior and exposes validation state', () => {
    const onChange = vi.fn()
    render(<TextField aria-label="Title" invalid onChange={onChange} />)

    const input = screen.getByRole('textbox', { name: 'Title' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveClass('border-danger')
    fireEvent.change(input, { target: { value: 'Draft' } })
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('provides a compact size', () => {
    render(<TextField inputSize="sm" aria-label="Filter" />)
    expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveClass(
      'h-[var(--control-height-sm)]'
    )
  })
})
