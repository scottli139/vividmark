import { test, expect } from '@playwright/test'

test.describe('File Tree', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display file tree tab', async ({ page }) => {
    // File tree tab should be visible
    const fileTreeTab = page.getByText('File Tree')
    await expect(fileTreeTab).toBeVisible()
  })

  test('should switch to file tree view when tab is clicked', async ({ page }) => {
    // Click on file tree tab
    await page.getByText('File Tree').click()

    // Open folder button should be visible
    const openFolderButton = page.getByText('Open Folder')
    await expect(openFolderButton).toBeVisible()
  })

  test('should switch back to outline view when tab is clicked', async ({ page }) => {
    // First switch to file tree
    await page.getByText('File Tree').click()

    // Then switch back to outline
    await page.getByText('Outline').click()

    // Outline content should be visible
    const noHeadings = page.getByText('No headings')
    await expect(noHeadings).toBeVisible()
  })

  test('should highlight active tab', async ({ page }) => {
    // Outline tab should be active by default
    const outlineTab = page.getByText('Outline')
    await expect(outlineTab).toHaveClass(/text-\[var\(--accent-color\)\]/)

    // Click on file tree tab
    await page.getByText('File Tree').click()

    // File tree tab should be active now
    const fileTreeTab = page.getByText('File Tree')
    await expect(fileTreeTab).toHaveClass(/text-\[var\(--accent-color\)\]/)
  })

  test('should show folder name when folder is opened', async ({ page }) => {
    // Note: This test would require mocking Tauri dialog
    // In real scenario, user would click "Open Folder" and select a directory
    // For now, we just verify the UI elements exist

    await page.getByText('File Tree').click()

    // Open folder button should be visible
    const openFolderButton = page.getByText('Open Folder')
    await expect(openFolderButton).toBeVisible()
  })
})
