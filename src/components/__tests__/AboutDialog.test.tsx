import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AboutDialog } from '../AboutDialog'
import { useEditorStore } from '../../stores/editorStore'

describe('AboutDialog', () => {
  beforeEach(() => {
    useEditorStore.setState({ isAboutOpen: false })
  })

  it('关闭时不渲染', () => {
    const { container } = render(<AboutDialog />)
    expect(container).toBeEmptyDOMElement()
  })

  it('打开时渲染名称/版本/版权/许可/链接', () => {
    useEditorStore.setState({ isAboutOpen: true })
    render(<AboutDialog />)

    expect(screen.getByText('VividMark')).toBeInTheDocument()
    // jsdom 无 Tauri，版本回退 dev
    expect(screen.getByText('Version dev')).toBeInTheDocument()
    expect(screen.getByText('Copyright © 2025 Scott Li')).toBeInTheDocument()
    expect(screen.getByText('MIT License')).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
  })

  it('点击 Close 关闭', () => {
    useEditorStore.setState({ isAboutOpen: true })
    render(<AboutDialog />)
    fireEvent.click(screen.getByText('Close'))
    expect(useEditorStore.getState().isAboutOpen).toBe(false)
  })

  it('Escape 关闭', () => {
    useEditorStore.setState({ isAboutOpen: true })
    render(<AboutDialog />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(useEditorStore.getState().isAboutOpen).toBe(false)
  })

  it('点 overlay 关闭', () => {
    useEditorStore.setState({ isAboutOpen: true })
    const { container } = render(<AboutDialog />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(useEditorStore.getState().isAboutOpen).toBe(false)
  })
})
