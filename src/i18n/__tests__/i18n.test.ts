import { describe, it, expect, beforeEach } from 'vitest'
import i18n, { availableLanguages, type Language } from '../index'

describe('i18n configuration', () => {
  beforeEach(async () => {
    // 重置为英语
    await i18n.changeLanguage('en')
  })

  it('should initialize with English as fallback language', () => {
    expect(i18n.options.fallbackLng).toContain('en')
  })

  it('should have English translations loaded', () => {
    expect(i18n.exists('toolbar.tooltip.newFile')).toBe(true)
    expect(i18n.exists('welcome.title')).toBe(true)
    expect(i18n.exists('sidebar.files')).toBe(true)
  })

  it('should have Chinese translations loaded', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.exists('toolbar.tooltip.newFile')).toBe(true)
    expect(i18n.exists('welcome.title')).toBe(true)
    expect(i18n.exists('sidebar.files')).toBe(true)
  })

  it('should translate to English correctly', () => {
    expect(i18n.t('welcome.title')).toBe('Welcome to VividMark')
    expect(i18n.t('toolbar.viewMode.source')).toBe('Source')
    expect(i18n.t('sidebar.files')).toBe('Files')
  })

  it('should translate to Chinese correctly', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('welcome.title')).toBe('欢迎使用 VividMark')
    expect(i18n.t('toolbar.viewMode.source')).toBe('源码')
    expect(i18n.t('sidebar.files')).toBe('文件')
  })

  it('should support interpolation', () => {
    expect(i18n.t('toolbar.tooltip.newFile', { shortcut: 'Cmd+N' })).toBe('New File (Cmd+N)')
  })

  it('should support Chinese interpolation', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('toolbar.tooltip.newFile', { shortcut: 'Cmd+N' })).toBe('新建文件 (Cmd+N)')
  })

  it('should have all required language options', () => {
    expect(availableLanguages).toHaveLength(2)
    expect(availableLanguages.map((l) => l.code)).toContain('en')
    expect(availableLanguages.map((l) => l.code)).toContain('zh-CN')
  })

  it('should have valid language names', () => {
    const enLang = availableLanguages.find((l) => l.code === 'en')
    const zhLang = availableLanguages.find((l) => l.code === 'zh-CN')

    expect(enLang?.name).toBe('English')
    expect(enLang?.flag).toBe('🇺🇸')
    expect(zhLang?.name).toBe('简体中文')
    expect(zhLang?.flag).toBe('🇨🇳')
  })

  it('should switch language correctly', async () => {
    expect(i18n.language).toBe('en')

    await i18n.changeLanguage('zh-CN')
    expect(i18n.language).toBe('zh-CN')

    await i18n.changeLanguage('en')
    expect(i18n.language).toBe('en')
  })

  it('should have complete translation keys for toolbar', () => {
    const toolbarKeys = [
      'toolbar.tooltip.toggleSidebar',
      'toolbar.tooltip.newFile',
      'toolbar.tooltip.openFile',
      'toolbar.tooltip.save',
      'toolbar.tooltip.undo',
      'toolbar.tooltip.redo',
      'toolbar.tooltip.bold',
      'toolbar.tooltip.italic',
      'toolbar.tooltip.insertImage',
      'toolbar.tooltip.insertTable',
      'toolbar.viewMode.source',
      'toolbar.viewMode.split',
      'toolbar.viewMode.preview',
    ]

    toolbarKeys.forEach((key) => {
      expect(i18n.exists(key), `Missing translation key: ${key}`).toBe(true)
    })
  })

  it('should have complete translation keys for sidebar', () => {
    const sidebarKeys = [
      'sidebar.files',
      'sidebar.recentFiles',
      'sidebar.outline',
      'sidebar.clear',
      'sidebar.noRecentFiles',
      'sidebar.filterRecent',
      'sidebar.noHeadings',
      'sidebar.words',
      'sidebar.chars',
    ]

    sidebarKeys.forEach((key) => {
      expect(i18n.exists(key), `Missing translation key: ${key}`).toBe(true)
    })
  })

  it('should have complete translation keys for dialogs', () => {
    const dialogKeys = [
      'dialog.confirmDiscard',
      'dialog.insertTable',
      'dialog.rows',
      'dialog.columns',
      'dialog.preview',
      'dialog.cancel',
      'dialog.insert',
    ]

    dialogKeys.forEach((key) => {
      expect(i18n.exists(key), `Missing translation key: ${key}`).toBe(true)
    })
  })
})

describe('Language type', () => {
  it('should accept valid language codes', () => {
    const validLanguages: Language[] = ['en', 'zh-CN']
    expect(validLanguages).toContain('en')
    expect(validLanguages).toContain('zh-CN')
  })
})
