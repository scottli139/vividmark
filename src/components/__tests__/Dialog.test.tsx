import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Dialog } from '../Dialog'
import { useDialogStore } from '../../stores/dialogStore'

describe('Dialog', () => {
  beforeEach(() => {
    useDialogStore.setState({ current: null })
  })

  function openDialog(kind: 'confirm' | 'alert', message = 'Discard unsaved changes?') {
    act(() => {
      void useDialogStore.getState().ask(kind, message)
    })
  }

  it('renders nothing when no dialog is open', () => {
    const { container } = render(<Dialog />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders confirm dialog with cancel + confirm buttons', () => {
    render(<Dialog />)
    openDialog('confirm')

    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('renders alert dialog with a single close button', () => {
    render(<Dialog />)
    openDialog('alert', 'Failed to open file')

    expect(screen.getByText('Failed to open file')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('confirm button answers true', () => {
    render(<Dialog />)
    openDialog('confirm')

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(useDialogStore.getState().current).toBeNull()
  })

  it('cancel button answers false', async () => {
    render(<Dialog />)
    let result: boolean | undefined
    act(() => {
      void useDialogStore
        .getState()
        .ask('confirm', 'Discard unsaved changes?')
        .then((value) => {
          result = value
        })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await act(async () => {})
    expect(result).toBe(false)
    expect(useDialogStore.getState().current).toBeNull()
  })

  it('Escape cancels, Enter confirms', async () => {
    render(<Dialog />)
    let result: boolean | undefined
    const askAndTrack = () =>
      act(() => {
        void useDialogStore
          .getState()
          .ask('confirm', 'Discard unsaved changes?')
          .then((value) => {
            result = value
          })
      })

    askAndTrack()
    fireEvent.keyDown(screen.getByText('Discard unsaved changes?').closest('.fixed')!, {
      key: 'Escape',
    })
    await act(async () => {})
    expect(result).toBe(false)

    askAndTrack()
    fireEvent.keyDown(screen.getByText('Discard unsaved changes?').closest('.fixed')!, {
      key: 'Enter',
    })
    await act(async () => {})
    expect(result).toBe(true)
  })

  it('clicking the overlay cancels; clicking the card does not', () => {
    render(<Dialog />)
    openDialog('confirm')

    const overlay = screen.getByText('Discard unsaved changes?').closest('.fixed')!
    const card = screen.getByText('Discard unsaved changes?').closest('.rounded-lg')!

    // 点卡片内部：不关闭
    fireEvent.click(card)
    expect(useDialogStore.getState().current).not.toBeNull()

    // 点 overlay 本体：关闭
    fireEvent.click(overlay)
    expect(useDialogStore.getState().current).toBeNull()
  })

  it('focuses the primary button when opened', () => {
    render(<Dialog />)
    openDialog('confirm')

    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus()
  })
})
