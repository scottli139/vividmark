import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WindowControls } from '../WindowControls'

const mockWindow = vi.hoisted(() => ({
  minimize: vi.fn().mockResolvedValue(undefined),
  toggleMaximize: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false),
  onResized: vi.fn().mockResolvedValue(vi.fn()),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWindow,
}))

describe('WindowControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWindow.isMaximized.mockResolvedValue(false)
    mockWindow.onResized.mockResolvedValue(vi.fn())
  })

  it('renders minimize / maximize / close buttons', () => {
    render(<WindowControls />)
    expect(screen.getByTitle('Minimize')).toBeInTheDocument()
    expect(screen.getByTitle('Maximize')).toBeInTheDocument()
    expect(screen.getByTitle('Close')).toBeInTheDocument()
  })

  it('calls window.minimize when minimize button is clicked', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByTitle('Minimize'))
    expect(mockWindow.minimize).toHaveBeenCalledTimes(1)
  })

  it('calls window.toggleMaximize when maximize button is clicked', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByTitle('Maximize'))
    expect(mockWindow.toggleMaximize).toHaveBeenCalledTimes(1)
  })

  it('calls window.close when close button is clicked (CloseRequested 脏确认由 windowManager 拦截)', () => {
    render(<WindowControls />)
    fireEvent.click(screen.getByTitle('Close'))
    expect(mockWindow.close).toHaveBeenCalledTimes(1)
  })

  it('shows Restore when window is maximized', async () => {
    mockWindow.isMaximized.mockResolvedValue(true)
    render(<WindowControls />)
    await waitFor(() => expect(screen.getByTitle('Restore')).toBeInTheDocument())
    expect(screen.queryByTitle('Maximize')).not.toBeInTheDocument()
  })

  it('registers an onResized listener to track maximize state', () => {
    render(<WindowControls />)
    expect(mockWindow.onResized).toHaveBeenCalledTimes(1)
  })
})
