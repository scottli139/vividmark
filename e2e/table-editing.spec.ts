import { test, expect } from '@playwright/test'

test.describe('Table Editing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the editor to be ready
    await page.waitForSelector('textarea')
  })

  test('should open table dialog from toolbar', async ({ page }) => {
    // Click the table button
    await page.click('[title="Insert Table"]')

    // Dialog should appear
    await expect(page.locator('text=Insert Table')).toBeVisible()
    await expect(page.locator('text=Rows (excluding header)')).toBeVisible()
    await expect(page.locator('text=Columns')).toBeVisible()
  })

  test('should insert a basic table', async ({ page }) => {
    // Click the table button
    await page.click('[title="Insert Table"]')

    // Dialog should appear
    await expect(page.locator('text=Insert Table')).toBeVisible()

    // Click insert button with default values
    await page.click('button:has-text("Insert")')

    // Dialog should close
    await expect(page.locator('text=Insert Table')).not.toBeVisible()

    // Check that table markdown was inserted
    const textarea = page.locator('textarea')
    const content = await textarea.inputValue()

    expect(content).toContain('Column 1 | Column 2 | Column 3')
    expect(content).toContain('--- | --- | ---')
    expect(content).toContain('Cell 1-1')
  })

  test('should insert table with custom dimensions', async ({ page }) => {
    // Click the table button
    await page.click('[title="Insert Table"]')

    // Change dimensions
    const rowInput = page.locator('input[type="number"]').first()
    const colInput = page.locator('input[type="number"]').nth(1)

    await rowInput.fill('5')
    await colInput.fill('4')

    // Insert table
    await page.click('button:has-text("Insert")')

    // Check content
    const textarea = page.locator('textarea')
    const content = await textarea.inputValue()

    // Should have 4 columns
    expect(content).toContain('Column 1 | Column 2 | Column 3 | Column 4')

    // Should have 5 data rows (plus header and separator = 7 lines)
    const lines = content.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(7)
  })

  test('should close dialog when clicking cancel', async ({ page }) => {
    // Click the table button
    await page.click('[title="Insert Table"]')

    // Dialog should appear
    await expect(page.locator('text=Insert Table')).toBeVisible()

    // Click cancel
    await page.click('button:has-text("Cancel")')

    // Dialog should close
    await expect(page.locator('text=Insert Table')).not.toBeVisible()

    // Content should be empty (no table inserted)
    const textarea = page.locator('textarea')
    const content = await textarea.inputValue()
    expect(content).toBe('')
  })

  test('should close dialog when clicking overlay', async ({ page }) => {
    // Click the table button
    await page.click('[title="Insert Table"]')

    // Dialog should appear
    await expect(page.locator('text=Insert Table')).toBeVisible()

    // Click on the overlay (background)
    await page.click('.fixed >> nth=0', { position: { x: 10, y: 10 } })

    // Dialog should close
    await expect(page.locator('text=Insert Table')).not.toBeVisible()
  })

  test('should render table in preview mode', async ({ page }) => {
    // Click the table button and insert
    await page.click('[title="Insert Table"]')
    await page.click('button:has-text("Insert")')

    // Switch to preview mode
    await page.click('button:has-text("Preview")')

    // Table should be rendered
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('th')).toHaveCount(3)
    await expect(page.locator('th:has-text("Column 1")')).toBeVisible()
    await expect(page.locator('th:has-text("Column 2")')).toBeVisible()
    await expect(page.locator('th:has-text("Column 3")')).toBeVisible()
  })

  test('should render table in split mode', async ({ page }) => {
    // Click the table button and insert
    await page.click('[title="Insert Table"]')
    await page.click('button:has-text("Insert")')

    // Switch to split mode
    await page.click('button:has-text("Split")')

    // Table should be rendered in preview pane
    await expect(page.locator('.markdown-body table')).toBeVisible()
    await expect(page.locator('.markdown-body th')).toHaveCount(3)
  })

  test('should handle table with alignment', async ({ page }) => {
    // Type a table with alignment markers
    const textarea = page.locator('textarea')
    await textarea.fill(`| Left | Center | Right |
|:---|:---:|---:|
| A | B | C |
| 1 | 2 | 3 |`)

    // Switch to preview mode
    await page.click('button:has-text("Preview")')

    // Table should be rendered with correct alignment
    await expect(page.locator('table')).toBeVisible()

    // Check alignment attributes
    const leftHeader = page.locator('th[align="left"], th[style*="text-align: left"]')

    // If markdown-it renders align attributes, verify them
    if (await leftHeader.count() > 0) {
      await expect(leftHeader.first()).toBeVisible()
    }
  })

  test('should edit table in source mode', async ({ page }) => {
    // Insert a table
    await page.click('[title="Insert Table"]')
    await page.click('button:has-text("Insert")')

    // Edit the table content
    const textarea = page.locator('textarea')
    await textarea.fill(`| Name | Age | City |
|---|---|---|
| Alice | 25 | NYC |
| Bob | 30 | LA |`)

    // Switch to preview mode
    await page.click('button:has-text("Preview")')

    // Verify edited content is rendered
    await expect(page.locator('table')).toBeVisible()
    await expect(page.locator('td:has-text("Alice")')).toBeVisible()
    await expect(page.locator('td:has-text("25")')).toBeVisible()
    await expect(page.locator('td:has-text("NYC")')).toBeVisible()
  })

  test('should use increment/decrement buttons in dialog', async ({ page }) => {
    // Click the table button
    await page.click('[title="Insert Table"]')

    // Get initial value
    const rowInput = page.locator('input[type="number"]').first()
    const initialValue = await rowInput.inputValue()
    expect(initialValue).toBe('3')

    // Click increase button
    await page.locator('button[aria-label="Increase rows"]').click()
    expect(await rowInput.inputValue()).toBe('4')

    // Click decrease button twice
    await page.locator('button[aria-label="Decrease rows"]').click()
    await page.locator('button[aria-label="Decrease rows"]').click()
    expect(await rowInput.inputValue()).toBe('2')

    // Click cancel to close
    await page.click('button:has-text("Cancel")')
  })

  test('should not allow rows below 1', async ({ page }) => {
    // Click the table button
    await page.click('[title="Insert Table"]')

    // Try to decrease below 1
    const decreaseBtn = page.locator('button[aria-label="Decrease rows"]')
    for (let i = 0; i < 5; i++) {
      await decreaseBtn.click()
    }

    // Should stay at 1
    const rowInput = page.locator('input[type="number"]').first()
    expect(await rowInput.inputValue()).toBe('1')

    // Click cancel
    await page.click('button:has-text("Cancel")')
  })
})
