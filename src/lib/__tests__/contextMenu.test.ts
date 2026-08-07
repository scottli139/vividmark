import { describe, it, expect } from 'vitest'
import type { MenuItem } from '../../components/Menu'
import {
  buildBaseEditItems,
  buildPreviewMenuItems,
  buildSourceMenuItems,
  buildWysiwygMenuItems,
  getShortcutLabels,
} from '../contextMenu'

/** 提取菜单结构：动作项取 id，分隔线取 '|' */
function itemIds(items: MenuItem[]): string[] {
  return items.map((item) => ('divider' in item ? '|' : item.id))
}

function getItem(items: MenuItem[], id: string) {
  return items.find((item) => !('divider' in item) && item.id === id)
}

const t = (key: string) => key
const mac = getShortcutLabels(true)
const win = getShortcutLabels(false)

describe('getShortcutLabels', () => {
  it('macOS uses symbol notation', () => {
    expect(mac.undo).toBe('⌘Z')
    expect(mac.redo).toBe('⇧⌘Z')
    expect(mac.paste).toBe('⌘V')
  })

  it('Windows/Linux uses Ctrl+ notation', () => {
    expect(win.undo).toBe('Ctrl+Z')
    expect(win.redo).toBe('Ctrl+Shift+Z')
    expect(win.selectAll).toBe('Ctrl+A')
  })
})

describe('buildBaseEditItems', () => {
  it('disables undo/redo and cut/copy based on state', () => {
    const items = buildBaseEditItems(t, mac, {
      canUndo: false,
      canRedo: false,
      hasSelection: false,
      includeFind: true,
    })
    expect(getItem(items, 'undo')).toMatchObject({ disabled: true, shortcut: '⌘Z' })
    expect(getItem(items, 'redo')).toMatchObject({ disabled: true })
    expect(getItem(items, 'cut')).toMatchObject({ disabled: true })
    expect(getItem(items, 'copy')).toMatchObject({ disabled: true })
    expect(getItem(items, 'paste')).not.toHaveProperty('disabled')
    expect(getItem(items, 'find')).toBeDefined()
  })

  it('enables undo/redo and cut/copy when state allows', () => {
    const items = buildBaseEditItems(t, mac, {
      canUndo: true,
      canRedo: true,
      hasSelection: true,
    })
    expect(getItem(items, 'undo')).toMatchObject({ disabled: false })
    expect(getItem(items, 'cut')).toMatchObject({ disabled: false })
    // WYSIWYG 无查找面板 → 省略
    expect(getItem(items, 'find')).toBeUndefined()
  })
})

describe('buildSourceMenuItems', () => {
  it('contains base edit group + find + paragraph/format submenus', () => {
    const items = buildSourceMenuItems(t, mac, {
      canUndo: true,
      canRedo: false,
      hasSelection: true,
    })
    expect(itemIds(items)).toEqual([
      'undo',
      'redo',
      '|',
      'cut',
      'copy',
      'paste',
      '|',
      'select-all',
      'find',
      '|',
      'submenu:paragraph',
      'submenu:format',
    ])

    const paragraph = getItem(items, 'submenu:paragraph')
    const format = getItem(items, 'submenu:format')
    expect(paragraph && 'children' in paragraph && itemIds(paragraph.children)).toEqual([
      'format:paragraph',
      'format:h1',
      'format:h2',
      'format:h3',
      'format:h4',
      'format:h5',
      'format:h6',
      '|',
      'format:quote',
      'format:list',
      'format:ol',
      'format:tasklist',
      'format:codeblock',
    ])
    expect(format && 'children' in format && itemIds(format.children)).toEqual([
      'format:bold',
      'format:italic',
      'format:strike',
      'format:code',
      'format:link',
    ])
    // 快捷键标注挂在子菜单内的格式项上
    const bold = format && 'children' in format && getItem(format.children, 'format:bold')
    expect(bold).toMatchObject({ shortcut: '⌘B' })
  })
})

describe('buildWysiwygMenuItems', () => {
  const state = { canUndo: true, canRedo: true, hasSelection: false }
  const plain = { inTable: false, onImage: false, inCodeBlock: false }

  it('plain paragraph context: no context group, no find; Typora-style submenus at tail', () => {
    const items = buildWysiwygMenuItems(t, mac, state, plain)
    const ids = itemIds(items)
    expect(ids[0]).toBe('undo')
    expect(ids).not.toContain('find')
    expect(ids.slice(-4)).toEqual(['|', 'submenu:paragraph', 'submenu:format', 'submenu:insert'])
  })

  it('paragraph submenu leads with Normal; insert submenu has paragraph-above/below', () => {
    const items = buildWysiwygMenuItems(t, mac, state, plain)
    const paragraph = getItem(items, 'submenu:paragraph')
    const insert = getItem(items, 'submenu:insert')
    expect(paragraph && 'children' in paragraph && itemIds(paragraph.children)).toEqual([
      'format:paragraph',
      'format:h1',
      'format:h2',
      'format:h3',
      'format:h4',
      'format:h5',
      'format:h6',
      '|',
      'format:quote',
      'format:list',
      'format:ol',
      'format:tasklist',
      'format:codeblock',
    ])
    expect(insert && 'children' in insert && itemIds(insert.children)).toEqual([
      'insert:image',
      'insert:table',
      'insert:codeblock',
      'insert:hr',
      '|',
      'insert:paragraph-above',
      'insert:paragraph-below',
    ])
  })

  it('table context prepends table group with single dividers', () => {
    const items = buildWysiwygMenuItems(t, mac, state, { ...plain, inTable: true })
    const ids = itemIds(items)
    expect(ids.slice(0, 11)).toEqual([
      'table:add-row-before',
      'table:add-row-after',
      'table:add-col-before',
      'table:add-col-after',
      '|',
      'table:delete-row',
      'table:delete-col',
      'table:delete-table',
      '|',
      'undo',
      'redo',
    ])
    // 无连续分隔线、无尾部分隔线
    expect(ids.join(',')).not.toMatch(/\|,\|/)
    expect(ids[ids.length - 1]).not.toBe('|')
  })

  it('disables delete-row in table header', () => {
    const items = buildWysiwygMenuItems(t, mac, state, {
      ...plain,
      inTable: true,
      inTableHeader: true,
    })
    expect(getItem(items, 'table:delete-row')).toMatchObject({ disabled: true })
  })

  it('link context adds link actions', () => {
    const items = buildWysiwygMenuItems(t, mac, state, {
      ...plain,
      linkHref: 'https://example.com',
    })
    const ids = itemIds(items)
    expect(ids.slice(0, 4)).toEqual(['link:open', 'link:copy', 'link:remove', '|'])
  })

  it('image and code block contexts add respective actions', () => {
    const imageItems = buildWysiwygMenuItems(t, mac, state, { ...plain, onImage: true })
    expect(itemIds(imageItems)).toContain('image:delete')

    const codeItems = buildWysiwygMenuItems(t, mac, state, { ...plain, inCodeBlock: true })
    expect(itemIds(codeItems)).toContain('codeblock:copy')
  })
})

describe('buildPreviewMenuItems', () => {
  it('base: copy / select-all / export-pdf; copy disabled without selection', () => {
    const items = buildPreviewMenuItems(t, mac, { hasSelection: false })
    expect(itemIds(items)).toEqual(['copy', 'select-all', '|', 'export-pdf'])
    expect(getItem(items, 'copy')).toMatchObject({ disabled: true })
  })

  it('link and image contexts prepend their actions', () => {
    const items = buildPreviewMenuItems(t, mac, {
      hasSelection: true,
      linkHref: 'https://example.com',
      imageSrc: './assets/a.png',
    })
    expect(itemIds(items)).toEqual([
      'link:open',
      'link:copy',
      'image:copy-src',
      '|',
      'copy',
      'select-all',
      '|',
      'export-pdf',
    ])
  })
})
