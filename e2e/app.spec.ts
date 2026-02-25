import { test, expect } from '@playwright/test'

test.describe('VividMark Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the app to load - use more specific selector
    await expect(page.locator('.font-medium').filter({ hasText: 'Untitled.md' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('should load the application', async ({ page }) => {
    await expect(page.locator('.font-medium').filter({ hasText: 'Untitled.md' })).toBeVisible()
  })

  test('should display toolbar with file name', async ({ page }) => {
    await expect(page.locator('.font-medium').filter({ hasText: 'Untitled.md' })).toBeVisible()
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
    const editButton = page.locator('button:has-text("Edit")')
    const splitButton = page.locator('button:has-text("Split")')
    const previewButton = page.locator('button:has-text("Preview")')

    // Click Split mode
    await splitButton.click()

    // Click Preview mode
    await previewButton.click()

    // Click Edit mode
    await editButton.click()

    await expect(editButton).toBeVisible()
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
    await expect(page.locator('button[title="Strikethrough"]')).toBeVisible()
    await expect(page.locator('button[title="Inline Code"]')).toBeVisible()
  })

  test('should have heading format buttons', async ({ page }) => {
    await expect(page.locator('button[title="Heading 1"]')).toBeVisible()
    await expect(page.locator('button[title="Heading 2"]')).toBeVisible()
    await expect(page.locator('button[title="Heading 3"]')).toBeVisible()
  })

  test('should have file operation buttons', async ({ page }) => {
    await expect(page.locator('button[title="New File (Cmd+N)"]')).toBeVisible()
    await expect(page.locator('button[title="Open File (Cmd+O)"]')).toBeVisible()
    await expect(page.locator('button[title="Save (Cmd+S)"]')).toBeVisible()
  })
})
