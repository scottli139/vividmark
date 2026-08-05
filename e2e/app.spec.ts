import { test, expect } from '@playwright/test'
import { presetSourceMode } from './sourceMode'

test.describe('VividMark Application', () => {
  test.beforeEach(async ({ page }) => {
    await presetSourceMode(page)
    await page.goto('/')
    // Wait for the app to load - CodeMirror editor visible
    await expect(page.locator('.cm-editor')).toBeVisible({
      timeout: 15000,
    })
  })

  test('should load the application', async ({ page }) => {
    await expect(page.locator('text=Untitled.md').first()).toBeVisible()
  })

  test('should display toolbar with file name', async ({ page }) => {
    await expect(page.locator('text=Untitled.md').first()).toBeVisible()
  })

  test('should toggle dark mode', async ({ page }) => {
    const darkModeButton = page.locator('button[title="Toggle Dark Mode"]')
    await darkModeButton.click()
    await expect(darkModeButton).toBeVisible()
  })

  test('should toggle sidebar', async ({ page }) => {
    // Sidebar should be visible by default
    await expect(page.locator('text=Current File')).toBeVisible()

    // Click sidebar toggle
    const sidebarButton = page.locator('button[title="Toggle Sidebar"]')
    await sidebarButton.click()

    // Sidebar should be hidden
    await expect(page.locator('text=Current File')).not.toBeVisible()

    // Click again to show
    await sidebarButton.click()
    await expect(page.locator('text=Current File')).toBeVisible()
  })

  test('should switch view modes', async ({ page }) => {
    const sourceButton = page.locator('button').filter({ hasText: /^Source$/ })
    const splitButton = page.locator('button').filter({ hasText: /^Split$/ })
    const previewButton = page.locator('button').filter({ hasText: /^Preview$/ })

    // Click Split mode
    await splitButton.click()

    // Click Preview mode
    await previewButton.click()

    // Click Source mode
    await sourceButton.click()

    await expect(sourceButton).toBeVisible()
    await expect(splitButton).toBeVisible()
    await expect(previewButton).toBeVisible()
  })

  test('should display outline in sidebar', async ({ page }) => {
    await expect(page.locator('text=Outline')).toBeVisible()
  })

  test('should display word count in sidebar', async ({ page }) => {
    await expect(page.locator('text=/Words:/i')).toBeVisible()
  })

  test('should display character count in sidebar', async ({ page }) => {
    await expect(page.locator('text=/Chars:/i')).toBeVisible()
  })

  test('should have format toolbar buttons', async ({ page }) => {
    await expect(page.locator('button[title="Bold (Cmd+B)"]')).toBeVisible()
    await expect(page.locator('button[title="Italic (Cmd+I)"]')).toBeVisible()

    // 删除线/行内代码在「更多格式」菜单内
    await page.click('button[title="More Formatting"]')
    await expect(page.locator('button:has-text("Strikethrough")')).toBeVisible()
    await expect(page.locator('button:has-text("Inline Code")')).toBeVisible()
  })

  test('should have heading format buttons', async ({ page }) => {
    // 标题按钮在 Heading 下拉菜单内
    await page.click('button[title="Heading"]')
    await expect(page.locator('button:has-text("Heading 1")')).toBeVisible()
    await expect(page.locator('button:has-text("Heading 2")')).toBeVisible()
    await expect(page.locator('button:has-text("Heading 3")')).toBeVisible()
  })

  test('should have file operation buttons', async ({ page }) => {
    await expect(page.locator('button[title="New File (Cmd+N)"]')).toBeVisible()
    await expect(page.locator('button[title="Open File (Cmd+O)"]')).toBeVisible()
    await expect(page.locator('button[title="Save (Cmd+S)"]')).toBeVisible()
  })
})
