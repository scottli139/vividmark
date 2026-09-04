import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { WindowResizeHandles } from '../WindowResizeHandles'
import { isLinuxDesktop } from '../../lib/platform'

const mockWindow = vi.hoisted(() => ({
  startResizeDragging: vi.fn().mockResolvedValue(undefined),
  isMaximized: vi.fn().mockResolvedValue(false),
  onResized: vi.fn().mockResolvedValue(vi.fn()),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWindow,
}))

vi.mock('../../lib/platform', () => ({
  isLinuxDesktop: vi.fn(),
}))

const mockIsLinuxDesktop = vi.mocked(isLinuxDesktop)

describe('WindowResizeHandles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLinuxDesktop.mockReturnValue(true)
    mockWindow.isMaximized.mockResolvedValue(false)
    mockWindow.onResized.mockResolvedValue(vi.fn())
  })

  it('renders nothing on non-Linux-desktop platforms', () => {
    mockIsLinuxDesktop.mockReturnValue(false)
    const { container } = render(<WindowResizeHandles />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders 8 direction handles on Linux desktop', () => {
    const { container } = render(<WindowResizeHandles />)
    const handles = container.querySelectorAll('[data-resize-direction]')
    expect(handles).toHaveLength(8)
    const dirs = Array.from(handles).map((h) => h.getAttribute('data-resize-direction'))
    expect(dirs).toEqual(
      expect.arrayContaining([
        'North',
        'South',
        'East',
        'West',
        'NorthEast',
        'NorthWest',
        'SouthEast',
        'SouthWest',
      ])
    )
  })

  it('starts resize dragging with the handle direction on left mousedown', () => {
    const { container } = render(<WindowResizeHandles />)
    fireEvent.mouseDown(container.querySelector('[data-resize-direction="East"]')!, {
      button: 0,
    })
    expect(mockWindow.startResizeDragging).toHaveBeenCalledWith('East')

    fireEvent.mouseDown(container.querySelector('[data-resize-direction="SouthWest"]')!, {
      button: 0,
    })
    expect(mockWindow.startResizeDragging).toHaveBeenCalledWith('SouthWest')
  })

  it('ignores non-left mouse buttons', () => {
    const { container } = render(<WindowResizeHandles />)
    fireEvent.mouseDown(container.querySelector('[data-resize-direction="East"]')!, {
      button: 2,
    })
    expect(mockWindow.startResizeDragging).not.toHaveBeenCalled()
  })

  it('hides handles when the window is maximized', async () => {
    mockWindow.isMaximized.mockResolvedValue(true)
    const { container } = render(<WindowResizeHandles />)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-resize-direction]')).toHaveLength(0)
    })
  })
})
