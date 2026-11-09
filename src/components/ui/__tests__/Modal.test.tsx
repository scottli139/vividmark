import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('closes on Escape and overlay clicks, but not card clicks', () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose} aria-label="Example">
        <p>Content</p>
      </Modal>
    )

    const dialog = screen.getByRole('dialog', { name: 'Example' })
    const overlay = dialog.parentElement!
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
