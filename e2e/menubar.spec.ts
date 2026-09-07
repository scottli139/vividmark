import { test, expect } from '@playwright/test'
import { presetSourceMode } from './sourceMode'

/**
 * 自绘菜单栏（Windows 桌面端 / 浏览器共用同一组件，E2E 覆盖浏览器路径）：
 * 结构、开合交互、勾选态、弹窗与菜单项左缘对齐（原生菜单弹窗位置不可控的修复）、
 * 菜单项动作与快捷键链路。
 */
test.describe('Menu Bar', () => {
  test.beforeEach(async ({ page }) => {
    await presetSourceMode(page)
    await page.goto('/')
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 15000 })
  })

  test('shows seven top-level menus in the toolbar', async ({ page }) => {
    const bar = page.getByTestId('menu-bar')
    await expect(bar).toBeVisible()
    for (const label of ['File', 'Edit', 'Paragraph', 'Format', 'View', 'Window', 'Help']) {
      await expect(bar.getByRole('button', { name: label, exact: true })).toBeVisible()
    }
  })

  test('opens dropdown directly under its menu item', async ({ page }) => {
    const trigger = page.getByTestId('menu-bar').getByRole('button', { name: 'File', exact: true })
    await trigger.click()

    const panel = page.getByRole('menu')
    await expect(panel).toBeVisible()
    await expect(panel.getByText('New', { exact: true })).toBeVisible()
    await expect(panel.getByText('Open…')).toBeVisible()
    await expect(panel.getByText('Save', { exact: true })).toBeVisible()

    // 弹窗左缘与菜单项左缘对齐（原生菜单弹窗偏右问题的修复验证）
    const btnBox = await trigger.boundingBox()
    const panelBox = await panel.boundingBox()
    expect(btnBox).not.toBeNull()
    expect(panelBox).not.toBeNull()
    expect(Math.abs(panelBox!.x - btnBox!.x)).toBeLessThanOrEqual(2)
    expect(panelBox!.y).toBeGreaterThanOrEqual(btnBox!.y + btnBox!.height - 1)
  })

  test('hover switches between menus while open; Escape closes', async ({ page }) => {
    const bar = page.getByTestId('menu-bar')
    await bar.getByRole('button', { name: 'File', exact: true }).click()
    await expect(page.getByRole('menu').getByText('New', { exact: true })).toBeVisible()

    await bar.getByRole('button', { name: 'Edit', exact: true }).hover()
    const menu = page.getByRole('menu')
    await expect(menu.getByText('Undo', { exact: true })).toBeVisible()
    await expect(menu.getByText('Paste as Plain Text')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).not.toBeVisible()
  })

  test('shows check state following view mode and applies selection', async ({ page }) => {
    await page
      .getByTestId('menu-bar')
      .getByRole('button', { name: 'View', exact: true })
      .click()
    const menu = page.getByRole('menu')
    // presetSourceMode：Source 应勾选
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Source' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    await expect(menu.getByRole('menuitemcheckbox', { name: 'WYSIWYG' })).toHaveAttribute(
      'aria-checked',
      'false'
    )

    await menu.getByRole('menuitemcheckbox', { name: 'WYSIWYG' }).click()
    await expect(page.getByTestId('statusbar-viewmode')).toHaveText('WYSIWYG')
  })

  test('applies theme via View ▸ Theme submenu', async ({ page }) => {
    await page
      .getByTestId('menu-bar')
      .getByRole('button', { name: 'View', exact: true })
      .click()
    await page.getByRole('menu').getByText('Theme', { exact: true }).hover()
    await page.getByRole('menuitemcheckbox', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('paragraph menu applies heading to current line', async ({ page }) => {
    await page.locator('.cm-content').click()
    await page.keyboard.type('Hello')

    await page
      .getByTestId('menu-bar')
      .getByRole('button', { name: 'Paragraph', exact: true })
      .click()
    await page.getByRole('menuitem', { name: 'Heading 1' }).click()

    await expect(page.locator('.cm-content')).toContainText('# Hello')
  })

  test('Ctrl+1 applies heading via keyboard (JS shortcut path)', async ({ page }) => {
    await page.locator('.cm-content').click()
    await page.keyboard.type('World')
    await page.keyboard.press('ControlOrMeta+1')

    await expect(page.locator('.cm-content')).toContainText('# World')
  })

  test('Ctrl+Shift+B toggles sidebar via keyboard', async ({ page }) => {
    const outlineTab = page.getByRole('button', { name: 'Outline', exact: true })
    await expect(outlineTab).toBeVisible()

    await page.keyboard.press('ControlOrMeta+Shift+B')
    await expect(outlineTab).not.toBeVisible()

    await page.keyboard.press('ControlOrMeta+Shift+B')
    await expect(outlineTab).toBeVisible()
  })

  test('Help ▸ About opens the about dialog', async ({ page }) => {
    await page
      .getByTestId('menu-bar')
      .getByRole('button', { name: 'Help', exact: true })
      .click()
    await page.getByRole('menuitem', { name: 'About VividMark' }).click()

    await expect(page.getByText('MIT License')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText('MIT License')).not.toBeVisible()
  })
})
