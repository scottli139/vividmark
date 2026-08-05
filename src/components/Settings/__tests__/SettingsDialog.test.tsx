import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsDialog } from '../SettingsDialog'
import { useEditorStore } from '../../../stores/editorStore'

describe('SettingsDialog', () => {
  beforeEach(() => {
    useEditorStore.setState({
      isSettingsOpen: false,
      themeMode: 'system',
      isDarkMode: false,
      language: 'en',
      showSidebar: true,
    })
  })

  describe('rendering', () => {
    it('should render nothing when closed', () => {
      const { container } = render(<SettingsDialog />)

      expect(container.firstChild).toBeNull()
    })

    it('should render dialog with all sections when open', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Appearance')).toBeInTheDocument()
      expect(screen.getByText('Language')).toBeInTheDocument()
      expect(screen.getByText('Sidebar')).toBeInTheDocument()
      expect(screen.getByText('Show Sidebar')).toBeInTheDocument()
    })
  })

  describe('theme mode', () => {
    it('should highlight current theme mode', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      const systemButton = screen.getByRole('button', { name: 'System' })
      // 当前 themeMode=system，高亮按钮带 --active-bg 类
      expect(systemButton.className).toContain('bg-[var(--active-bg)]')
    })

    it('should call setThemeMode when theme option is clicked', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
      expect(useEditorStore.getState().themeMode).toBe('dark')
      expect(useEditorStore.getState().isDarkMode).toBe(true)

      fireEvent.click(screen.getByRole('button', { name: 'Light' }))
      expect(useEditorStore.getState().themeMode).toBe('light')
      expect(useEditorStore.getState().isDarkMode).toBe(false)

      fireEvent.click(screen.getByRole('button', { name: 'System' }))
      expect(useEditorStore.getState().themeMode).toBe('system')
    })
  })

  describe('language', () => {
    it('should check current language radio', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
      expect(screen.getByRole('radio', { name: '简体中文' })).not.toBeChecked()
    })

    it('should change language when radio is clicked', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      fireEvent.click(screen.getByRole('radio', { name: '简体中文' }))

      expect(useEditorStore.getState().language).toBe('zh-CN')
    })
  })

  describe('sidebar', () => {
    it('should toggle showSidebar when checkbox is clicked', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()

      fireEvent.click(checkbox)
      expect(useEditorStore.getState().showSidebar).toBe(false)
    })
  })

  describe('close', () => {
    it('should close when close button is clicked', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      fireEvent.click(screen.getByTitle('Close'))

      expect(useEditorStore.getState().isSettingsOpen).toBe(false)
    })

    it('should close when Escape is pressed', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(useEditorStore.getState().isSettingsOpen).toBe(false)
    })

    it('should close when overlay is clicked', () => {
      useEditorStore.getState().setSettingsOpen(true)
      const { container } = render(<SettingsDialog />)

      // overlay 是最外层 fixed 容器，点击自身（target === currentTarget）关闭
      const overlay = container.firstChild as HTMLElement
      fireEvent.click(overlay)

      expect(useEditorStore.getState().isSettingsOpen).toBe(false)
    })

    it('should not close when dialog card is clicked', () => {
      useEditorStore.getState().setSettingsOpen(true)
      render(<SettingsDialog />)

      fireEvent.click(screen.getByText('Appearance'))

      expect(useEditorStore.getState().isSettingsOpen).toBe(true)
    })
  })
})
