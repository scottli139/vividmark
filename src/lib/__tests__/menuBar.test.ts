import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildMenuBarMenus, type MenuBarState } from '../menuBar'
import type { MenuActionItem, MenuItem, MenuSubmenuItem } from '../../components/Menu'
import type { ThemeMode } from '../theme'

/**
 * menuBar 构建器测试：结构对齐 menu.rs 的 Windows 布局；checked/disabled
 * 从状态快照映射；Open Recent 子菜单动态生成。
 * t 用恒等 key 返回（断言翻译 key 本身即可，标签渲染由组件测试覆盖）。
 */

const t = (key: string) => key

// setup.ts 把 navigator.platform mock 为 MacIntel；快捷键标注断言固定走 Win32
const originalPlatform = navigator.platform
beforeEach(() => {
  Object.defineProperty(navigator, 'platform', { value: 'Win32', writable: true })
})
afterEach(() => {
  Object.defineProperty(navigator, 'platform', { value: originalPlatform, writable: true })
})

function makeState(overrides: Partial<MenuBarState> = {}): MenuBarState {
  return {
    viewMode: 'wysiwyg',
    themeMode: 'system',
    sidebarTab: 'outline',
    canUndo: false,
    canRedo: false,
    filePath: null,
    openedFolder: null,
    recentFiles: [],
    ...overrides,
  }
}

function findMenu(menus: ReturnType<typeof buildMenuBarMenus>, id: string) {
  const menu = menus.find((m) => m.id === id)
  if (!menu) throw new Error(`menu ${id} not found`)
  return menu
}

function actionItems(items: MenuItem[]): MenuActionItem[] {
  return items.filter((i): i is MenuActionItem => !('divider' in i) && !('children' in i))
}

function findItem(items: MenuItem[], id: string): MenuActionItem | undefined {
  return actionItems(items).find((i) => i.id === id)
}

describe('buildMenuBarMenus', () => {
  it('按序返回七个顶级菜单', () => {
    const menus = buildMenuBarMenus(t, makeState())
    expect(menus.map((m) => m.id)).toEqual([
      'file',
      'edit',
      'paragraph',
      'format',
      'view',
      'window',
      'help',
    ])
    expect(menus.map((m) => m.label)).toEqual([
      'menu.file',
      'menu.edit',
      'menu.paragraph',
      'menu.format',
      'menu.view',
      'menu.window',
      'menu.help',
    ])
  })

  it('File 菜单结构与 menu.rs 对齐（含 Settings/Exit 尾部）', () => {
    const { items } = findMenu(buildMenuBarMenus(t, makeState()), 'file')
    const ids = items.map((i) => ('divider' in i ? '---' : i.id))
    expect(ids).toEqual([
      'file-new',
      'file-open',
      'open-recent',
      '---',
      'file-open-folder',
      'file-reveal',
      '---',
      'file-save',
      'file-save-as',
      '---',
      'export-pdf',
      'export-site',
      '---',
      'settings',
      '---',
      'file:exit',
    ])
  })

  it('file-reveal 按 filePath 门控，export-site 按 openedFolder 门控', () => {
    let menus = buildMenuBarMenus(t, makeState())
    expect(findItem(findMenu(menus, 'file').items, 'file-reveal')?.disabled).toBe(true)
    expect(findItem(findMenu(menus, 'file').items, 'export-site')?.disabled).toBe(true)

    menus = buildMenuBarMenus(t, makeState({ filePath: '/a/b.md', openedFolder: '/a' }))
    expect(findItem(findMenu(menus, 'file').items, 'file-reveal')?.disabled).toBe(false)
    expect(findItem(findMenu(menus, 'file').items, 'export-site')?.disabled).toBe(false)
  })

  it('undo/redo 按 canUndo/canRedo 门控', () => {
    let menus = buildMenuBarMenus(t, makeState())
    expect(findItem(findMenu(menus, 'edit').items, 'edit-undo')?.disabled).toBe(true)

    menus = buildMenuBarMenus(t, makeState({ canUndo: true, canRedo: true }))
    expect(findItem(findMenu(menus, 'edit').items, 'edit-undo')?.disabled).toBe(false)
    expect(findItem(findMenu(menus, 'edit').items, 'edit-redo')?.disabled).toBe(false)
  })

  it('Edit 菜单含自绘平替的剪贴板四项与查找', () => {
    const { items } = findMenu(buildMenuBarMenus(t, makeState()), 'edit')
    const ids = actionItems(items).map((i) => i.id)
    expect(ids).toEqual([
      'edit-undo',
      'edit-redo',
      'edit-cut',
      'edit-copy',
      'edit-paste',
      'edit-paste-plain',
      'edit-select-all',
      'edit-find',
    ])
  })

  it('Open Recent 空态：禁用占位 + 禁用的清空项', () => {
    const { items } = findMenu(buildMenuBarMenus(t, makeState()), 'file')
    const recent = items.find((i): i is MenuSubmenuItem => 'children' in i)
    expect(recent).toBeDefined()
    const ids = recent!.children.map((i) => ('divider' in i ? '---' : i.id))
    expect(ids).toEqual(['open-recent-empty', '---', 'clear-recent'])
    const clear = findItem(recent!.children, 'clear-recent')
    expect(clear?.disabled).toBe(true)
  })

  it('Open Recent 动态生成文件项（id 带路径），末尾清空可用', () => {
    const menus = buildMenuBarMenus(
      t,
      makeState({
        recentFiles: [
          { name: 'a.md', path: '/x/a.md' },
          { name: 'b.md', path: '/y/b.md' },
        ],
      })
    )
    const { items } = findMenu(menus, 'file')
    const recent = items.find((i): i is MenuSubmenuItem => 'children' in i)!
    const fileItems = actionItems(recent.children).filter((i) => i.id.startsWith('open-recent:'))
    expect(fileItems.map((i) => i.id)).toEqual(['open-recent:/x/a.md', 'open-recent:/y/b.md'])
    expect(fileItems.map((i) => i.label)).toEqual(['a.md', 'b.md'])
    expect(findItem(recent.children, 'clear-recent')?.disabled).toBe(false)
  })

  it('View 菜单勾选态跟随 viewMode/themeMode/sidebarTab', () => {
    const menus = buildMenuBarMenus(
      t,
      makeState({ viewMode: 'split', themeMode: 'dark', sidebarTab: 'files' })
    )
    const { items } = findMenu(menus, 'view')
    expect(findItem(items, 'view-mode-split')?.checked).toBe(true)
    expect(findItem(items, 'view-mode-wysiwyg')?.checked).toBe(false)
    expect(findItem(items, 'view-sidebar-files')?.checked).toBe(true)
    expect(findItem(items, 'view-sidebar-outline')?.checked).toBe(false)

    const theme = items.find((i): i is MenuSubmenuItem => 'children' in i && i.id === 'theme')!
    expect(findItem(theme.children, 'theme-dark')?.checked).toBe(true)
    expect(findItem(theme.children, 'theme-light')?.checked).toBe(false)
  })

  it('快捷键标注（非 Mac 为 Ctrl 风格）', () => {
    const menus = buildMenuBarMenus(t, makeState())
    const file = findMenu(menus, 'file')
    expect(findItem(file.items, 'file-new')?.shortcut).toBe('Ctrl+N')
    expect(findItem(file.items, 'file-save')?.shortcut).toBe('Ctrl+S')

    const paragraph = findMenu(menus, 'paragraph')
    expect(findItem(paragraph.items, 'format:h1')?.shortcut).toBe('Ctrl+1')
    expect(findItem(paragraph.items, 'format:quote')?.shortcut).toBe('Ctrl+Alt+Q')

    const view = findMenu(menus, 'view')
    expect(findItem(view.items, 'view:fullscreen')?.shortcut).toBe('F11')
    expect(findItem(view.items, 'zoom-reset')?.shortcut).toBe('Ctrl+Shift+0')
  })

  it('themeMode 覆盖三种主题取值', () => {
    for (const mode of ['light', 'dark', 'system'] as ThemeMode[]) {
      const menus = buildMenuBarMenus(t, makeState({ themeMode: mode }))
      const view = findMenu(menus, 'view')
      const theme = view.items.find(
        (i): i is MenuSubmenuItem => 'children' in i && i.id === 'theme'
      )!
      expect(findItem(theme.children, `theme-${mode}`)?.checked).toBe(true)
    }
  })
})
