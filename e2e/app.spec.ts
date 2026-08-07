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
    // 文件名仅体现在原生窗口标题（浏览器 e2e 环境不可见），此处校验页面标题
    await expect(page).toHaveTitle(/vividmark/i)
  })

  test('should toggle dark mode', async ({ page }) => {
    const darkModeButton = page.locator('button[title="Toggle Dark Mode"]')
    await darkModeButton.click()
    await expect(darkModeButton).toBeVisible()
  })

  test('should toggle sidebar', async ({ page }) => {
    // Sidebar should be visible by default（以「大纲」tab 作为侧栏可见性标志）
    const outlineTab = page.getByRole('button', { name: 'Outline', exact: true })
    await expect(outlineTab).toBeVisible()

    // Click sidebar toggle
    const sidebarButton = page.locator('button[title="Toggle Sidebar"]')
    await sidebarButton.click()

    // Sidebar should be hidden
    await expect(outlineTab).not.toBeVisible()

    // Click again to show
    await sidebarButton.click()
    await expect(outlineTab).toBeVisible()
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

  test('should have high-frequency toolbar buttons only', async ({ page }) => {
    // 精简后的工具栏：侧边栏切换 / 撤销重做 / 视图切换 / 暗色 / 更多菜单
    await expect(page.locator('button[title="Toggle Sidebar"]')).toBeVisible()
    await expect(page.locator('button[title="Undo (Cmd+Z)"]')).toBeVisible()
    await expect(page.locator('button[title="Redo (Cmd+Shift+Z)"]')).toBeVisible()
    await expect(page.locator('button[title="Toggle Dark Mode"]')).toBeVisible()
    await expect(page.locator('button[title="More"]')).toBeVisible()

    // 文件操作与格式化按钮已移到原生菜单/右键菜单
    await expect(page.locator('button[title="Bold (Cmd+B)"]')).not.toBeVisible()
    await expect(page.locator('button[title="New File (Cmd+N)"]')).not.toBeVisible()
    await expect(page.locator('button[title="Save (Cmd+S)"]')).not.toBeVisible()
  })

  test('should expose zoom and settings via more menu', async ({ page }) => {
    await page.click('button[title="More"]')
    await expect(page.locator('button:has-text("Zoom In")')).toBeVisible()
    await expect(page.locator('button:has-text("Export PDF")')).toBeVisible()
    await expect(page.locator('button:has-text("Settings")')).toBeVisible()
  })
})
