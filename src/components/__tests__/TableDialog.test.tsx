import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableDialog } from '../TableDialog'

describe('TableDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnInsert = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <TableDialog isOpen={false} onClose={mockOnClose} onInsert={mockOnInsert} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render when isOpen is true', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    expect(screen.getByText('Insert Table')).toBeInTheDocument()
    expect(screen.getByText('Rows (excluding header)')).toBeInTheDocument()
    expect(screen.getByText('Columns')).toBeInTheDocument()
  })

  it('should render with default values', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    const colInput = screen.getAllByRole('spinbutton')[1]

    expect(rowInput).toHaveValue(3)
    expect(colInput).toHaveValue(3)
  })

  it('should close dialog when Cancel is clicked', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should close dialog when clicking overlay', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const overlay = screen.getByText('Insert Table').closest('.fixed')
    fireEvent.click(overlay!)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onInsert and close when Insert is clicked', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    fireEvent.click(screen.getByText('Insert'))

    expect(mockOnInsert).toHaveBeenCalledWith(3, 3)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should increase rows when + button is clicked', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowIncreaseBtn = screen.getAllByRole('button', { name: /increase/i })[0]
    fireEvent.click(rowIncreaseBtn)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    expect(rowInput).toHaveValue(4)
  })

  it('should decrease rows when - button is clicked', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowDecreaseBtn = screen.getAllByRole('button', { name: /decrease/i })[0]
    fireEvent.click(rowDecreaseBtn)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    expect(rowInput).toHaveValue(2)
  })

  it('should not decrease rows below 1', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowDecreaseBtn = screen.getAllByRole('button', { name: /decrease/i })[0]

    // Click multiple times
    fireEvent.click(rowDecreaseBtn)
    fireEvent.click(rowDecreaseBtn)
    fireEvent.click(rowDecreaseBtn)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    expect(rowInput).toHaveValue(1)
  })

  it('should increase columns when + button is clicked', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const colIncreaseBtn = screen.getAllByRole('button', { name: /increase/i })[1]
    fireEvent.click(colIncreaseBtn)

    const colInput = screen.getAllByRole('spinbutton')[1]
    expect(colInput).toHaveValue(4)
  })

  it('should allow direct input editing', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(rowInput, { target: { value: '5' } })

    expect(rowInput).toHaveValue(5)
  })

  it('should handle invalid input gracefully', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(rowInput, { target: { value: 'abc' } })

    // Should default to 1 for invalid input
    expect(rowInput).toHaveValue(1)
  })

  it('should clamp values to max limit', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(rowInput, { target: { value: '100' } })

    expect(rowInput).toHaveValue(50)
  })

  it('should render table preview', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    expect(screen.getByText('Preview')).toBeInTheDocument()
    // Preview table should show 3 columns (Col 1, Col 2, Col 3)
    expect(screen.getByText('Col 1')).toBeInTheDocument()
    expect(screen.getByText('Col 2')).toBeInTheDocument()
    expect(screen.getByText('Col 3')).toBeInTheDocument()
  })

  it('should update preview when values change', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const colInput = screen.getAllByRole('spinbutton')[1]
    fireEvent.change(colInput, { target: { value: '4' } })

    expect(screen.getByText('Col 4')).toBeInTheDocument()
  })

  it('should close on Escape key', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    fireEvent.keyDown(screen.getByText('Insert Table'), { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onInsert with correct values after modification', () => {
    render(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    const rowInput = screen.getAllByRole('spinbutton')[0]
    const colInput = screen.getAllByRole('spinbutton')[1]

    fireEvent.change(rowInput, { target: { value: '5' } })
    fireEvent.change(colInput, { target: { value: '4' } })

    fireEvent.click(screen.getByText('Insert'))

    expect(mockOnInsert).toHaveBeenCalledWith(5, 4)
  })

  it('should reset to defaults after insert', () => {
    const { rerender } = render(
      <TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />
    )

    // Change values
    const rowInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(rowInput, { target: { value: '10' } })

    // Insert
    fireEvent.click(screen.getByText('Insert'))

    // Reopen dialog
    rerender(<TableDialog isOpen={true} onClose={mockOnClose} onInsert={mockOnInsert} />)

    // Should be reset to defaults
    const newRowInput = screen.getAllByRole('spinbutton')[0]
    expect(newRowInput).toHaveValue(3)
  })
})
