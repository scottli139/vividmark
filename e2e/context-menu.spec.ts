import { test, expect, type Page } from '@playwright/test'
import { presetSourceMode } from './sourceMode'

/**
 * 编辑器右键菜单端到端测试
 * 覆盖：Source / Preview / WYSIWYG 三区域的菜单弹出、disabled 态、
 * 格式动作接线、WYSIWYG 表格上下文组。
 */

/** 预置任意视图模式（同 presetSourceMode 的 localStorage 机制） */
async function presetViewMode(page: Page, mode: 'source' | 'preview' | 'wysiwyg'): Promise<void> {
  await page.addInitScript((viewMode) => {
    window.localStorage.setItem(
      'vividmark-storage',
      JSON.stringify({ state: { viewMode }, version: 0 })
    )
  }, mode)
}

/** CodeMirror 编辑器全文（innerText 保留行间换行） */
async function sourceEditorText(page: Page): Promise<string> {
  return (await page.locator('.cm-content').innerText()).trimEnd()
}

test.describe('Context Menu — Source mode', () => {
  test.beforeEach(async ({ page }) => {
    await presetSourceMode(page)
    await page.goto('/')
    await page.waitForSelector('.cm-content')
  })

  test('right-click shows edit menu with disabled states; Escape closes', async ({ page }) => {
    await page.locator('.cm-content').click({ button: 'right' })

    const menu = page.locator('[role="menu"]').first()
    await expect(menu).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Undo' })).toBeDisabled()
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeDisabled()
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeDisabled()
    await expect(page.getByRole('menuitem', { name: 'Paste' })).toBeEnabled()
    await expect(page.getByRole('menuitem', { name: 'Select All' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Find' })).toBeVisible()
    // Typora 结构：段落 / 格式为子菜单
    await expect(page.getByRole('menuitem', { name: 'Paragraph' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Format' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })

  test('Bold submenu item applies bold format to editor', async ({ page }) => {
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')

    await page.locator('.cm-content').click({ button: 'right' })
    // 格式项在「Format ▸」子菜单内
    await page.getByRole('menuitem', { name: 'Format' }).hover()
    await page.getByRole('menuitem', { name: 'Bold' }).click()

    // 无选区时插入占位符并选中（与工具栏 editor-format 行为一致）
    await expect.poll(() => sourceEditorText(page)).toContain('**bold text**')
  })

  test('Select All selects the whole document and enables cut/copy', async ({ page }) => {
    await page.locator('.cm-content').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Select All' }).click()

    await page.locator('.cm-content').click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Cut' })).toBeEnabled()
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeEnabled()
  })
})

test.describe('Context Menu — Preview mode', () => {
  // 预览渲染容器（区别于常驻挂载的 .markdown-body.wysiwyg-editor）
  const previewBody = '.markdown-body.p-8'

  test.beforeEach(async ({ page }) => {
    await presetViewMode(page, 'preview')
    await page.goto('/')
    await page.waitForSelector(previewBody)
  })

  test('right-click shows preview menu; Select All selects rendered content', async ({ page }) => {
    await page.locator(previewBody).click({ button: 'right' })

    const menu = page.locator('[role="menu"]')
    await expect(menu).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeDisabled()
    await expect(page.getByRole('menuitem', { name: 'Select All' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Export PDF' })).toBeVisible()

    await page.getByRole('menuitem', { name: 'Select All' }).click()
    const selected = await page.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selected.length).toBeGreaterThan(0)

    // 有选区后再开菜单，Copy 变为可用
    await page.locator(previewBody).click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Copy' })).toBeEnabled()
  })
})

test.describe('Context Menu — WYSIWYG mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.ProseMirror')).toBeVisible()
  })

  test('right-click shows menu without Find (known limitation)', async ({ page }) => {
    await page.locator('.ProseMirror').click({ button: 'right' })

    const menu = page.locator('[role="menu"]').first()
    await expect(menu).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Undo' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Paragraph' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Insert' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Find' })).toHaveCount(0)
  })

  test('Insert submenu inserts paragraph below current block', async ({ page }) => {
    const proseMirror = page.locator('.ProseMirror')
    await proseMirror.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('# Title')

    await expect(proseMirror.locator('h1')).toHaveText('Title')

    // 光标在标题上，右键 → Insert ▸ → Insert Paragraph Below
    await proseMirror.locator('h1').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Insert', exact: true }).hover()
    await page.getByRole('menuitem', { name: 'Insert Paragraph Below' }).click()

    // 标题后出现新段落，光标可直接输入
    await page.keyboard.type('new paragraph')
    await expect(proseMirror.locator('p')).toContainText('new paragraph')
  })

  test('table context group adds a row below', async ({ page }) => {
    // 切到 Source 输入表格 markdown，再切回 WYSIWYG
    await page.click('button[title="Source"]')
    await page.waitForSelector('.cm-content')
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('| A | B |\n| --- | --- |\n| 1 | 2 |')

    await page.click('button[title="WYSIWYG"]')
    const table = page.locator('.ProseMirror table')
    await expect(table).toBeVisible()
    const rowsBefore = await page.locator('.ProseMirror tr').count()

    // 右键数据单元格 → 表格上下文组
    await page.locator('.ProseMirror td', { hasText: '1' }).click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Add Row Below' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Delete Table' })).toBeVisible()

    await page.getByRole('menuitem', { name: 'Add Row Below' }).click()
    await expect(page.locator('.ProseMirror tr')).toHaveCount(rowsBefore + 1)
  })

  test('link context group offers open/copy/remove', async ({ page }) => {
    await page.click('button[title="Source"]')
    await page.waitForSelector('.cm-content')
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
    await page.keyboard.type('[docs](https://example.com)')

    await page.click('button[title="WYSIWYG"]')
    const link = page.locator('.ProseMirror a')
    await expect(link).toBeVisible()

    await link.click({ button: 'right' })
    await expect(page.getByRole('menuitem', { name: 'Open Link' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Copy Link' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Remove Link' })).toBeVisible()

    await page.getByRole('menuitem', { name: 'Remove Link' }).click()
    await expect(page.locator('.ProseMirror a')).toHaveCount(0)
    await expect(page.locator('.ProseMirror')).toContainText('docs')
  })
})
