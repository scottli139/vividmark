import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { StatusBar } from '../StatusBar'
import { useEditorStore } from '../../../stores/editorStore'

describe('StatusBar', () => {
  beforeEach(() => {
    useEditorStore.setState({
      content: 'One two three',
      filePath: null,
      fileName: 'test.md',
      viewMode: 'source',
      zoomLevel: 100,
      cursorLine: 1,
      cursorCol: 1,
    })
  })

  it('should display word and character counts', () => {
    render(<StatusBar />)

    expect(screen.getByText('Words: 3')).toBeInTheDocument()
    expect(screen.getByText('Chars: 13')).toBeInTheDocument()
  })

  it('should display cursor position in source mode', () => {
    useEditorStore.setState({ cursorLine: 5, cursorCol: 12 })

    render(<StatusBar />)

    expect(screen.getByText('Ln 5, Col 12')).toBeInTheDocument()
  })

  it('should display cursor position in split mode', () => {
    useEditorStore.setState({ viewMode: 'split', cursorLine: 2, cursorCol: 3 })

    render(<StatusBar />)

    expect(screen.getByText('Ln 2, Col 3')).toBeInTheDocument()
  })

  it('should hide cursor position in preview mode', () => {
    useEditorStore.setState({ viewMode: 'preview' })

    render(<StatusBar />)

    expect(screen.queryByTestId('statusbar-cursor')).not.toBeInTheDocument()
  })

  it('should display current view mode label', () => {
    render(<StatusBar />)

    expect(screen.getByText('Source')).toBeInTheDocument()
  })

  it('should display zoom percentage and reset to 100% on click', () => {
    useEditorStore.setState({ zoomLevel: 150 })

    render(<StatusBar />)

    const zoomButton = screen.getByText('150%')
    fireEvent.click(zoomButton)

    expect(useEditorStore.getState().zoomLevel).toBe(100)
  })

  it('should update statistics after content changes (debounced)', async () => {
    render(<StatusBar />)

    expect(screen.getByText('Words: 3')).toBeInTheDocument()

    act(() => {
      useEditorStore.getState().setContent('one two')
    })

    // 200ms 防抖后更新
    await waitFor(() => {
      expect(screen.getByText('Words: 2')).toBeInTheDocument()
      expect(screen.getByText('Chars: 7')).toBeInTheDocument()
    })
  })
})
