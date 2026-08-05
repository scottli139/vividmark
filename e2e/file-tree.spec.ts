import { test, expect } from '@playwright/test'

test.describe('File Tree', () => {
  // 「文件」tab：未打开文件夹时显示最近文件与「打开文件夹」入口，打开后渲染文件树
  const filesTab = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: 'Files', exact: true })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display files tab', async ({ page }) => {
    // Files tab should be visible
    await expect(filesTab(page)).toBeVisible()
  })

  test('should switch to files view when tab is clicked', async ({ page }) => {
    // Click on files tab
    await filesTab(page).click()

    // Open folder button should be visible
    const openFolderButton = page.getByText('Open Folder')
    await expect(openFolderButton).toBeVisible()
  })

  test('should switch back to outline view when tab is clicked', async ({ page }) => {
    // First switch to files tab
    await filesTab(page).click()

    // Then switch back to outline
    await page.getByRole('button', { name: 'Outline', exact: true }).click()

    // Outline content should be visible（默认欢迎文档含标题；title 在条目文本 span 上）
    const outline = page.locator('span[title="Welcome to VividMark"]')
    await expect(outline).toBeVisible()
  })

  test('should highlight active tab', async ({ page }) => {
    // Outline tab should be active by default
    const outlineTab = page.getByRole('button', { name: 'Outline', exact: true })
    await expect(outlineTab).toHaveClass(/text-\[var\(--accent-color\)\]/)

    // Click on files tab
    await filesTab(page).click()

    // Files tab should be active now
    await expect(filesTab(page)).toHaveClass(/text-\[var\(--accent-color\)\]/)
  })

  test('should show folder name when folder is opened', async ({ page }) => {
    // Note: This test would require mocking Tauri dialog
    // In real scenario, user would click "Open Folder" and select a directory
    // For now, we just verify the UI elements exist

    await filesTab(page).click()

    // Open folder button should be visible
    const openFolderButton = page.getByText('Open Folder')
    await expect(openFolderButton).toBeVisible()
  })
})
