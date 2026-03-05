import { test, expect } from '@playwright/test'

test.describe('Task List (Checkbox) Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for the app to load
    await expect(page.locator('.font-medium').filter({ hasText: 'Untitled.md' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('should render task list in preview mode', async ({ page }) => {
    // Switch to source mode and add task list content
    const sourceButton = page.locator('button').filter({ hasText: /^Source$/ })
    await sourceButton.click()

    // Find textarea and set content
    const textarea = page.locator('textarea')
    await textarea.fill(`- [ ] Unchecked task
- [x] Checked task`)

    // Switch to preview mode
    const previewButton = page.locator('button').filter({ hasText: /^Preview$/ })
    await previewButton.click()

    // Verify task list is rendered
    await expect(page.locator('.task-list-item')).toHaveCount(2)
    await expect(page.locator('.task-checkbox')).toHaveCount(2)

    // Verify unchecked item
    const firstCheckbox = page.locator('.task-checkbox').first()
    await expect(firstCheckbox).not.toBeChecked()

    // Verify checked item
    const secondCheckbox = page.locator('.task-checkbox').nth(1)
    await expect(secondCheckbox).toBeChecked()
  })

  test('should toggle checkbox from unchecked to checked in preview mode', async ({ page }) => {
    // Switch to source mode and add task list
    const sourceButton = page.locator('button').filter({ hasText: /^Source$/ })
    await sourceButton.click()

    const textarea = page.locator('textarea')
    await textarea.fill('- [ ] Task to check')

    // Switch to preview mode
    const previewButton = page.locator('button').filter({ hasText: /^Preview$/ })
    await previewButton.click()

    // Verify initial state
    const checkbox = page.locator('.task-checkbox').first()
    await expect(checkbox).not.toBeChecked()

    // Click to check
    await checkbox.click()

    // Wait a bit for state to update
    await page.waitForTimeout(300)

    // Wait for React to re-render and then verify checkbox is checked
    await page.waitForTimeout(500)
    await expect(checkbox).toBeChecked()

    // Switch back to source mode to verify markdown was updated
    await sourceButton.click()
    await expect(textarea).toHaveValue('- [x] Task to check')
  })

  test('should toggle checkbox from checked to unchecked in preview mode', async ({ page }) => {
    // Switch to source mode and add checked task list
    const sourceButton = page.locator('button').filter({ hasText: /^Source$/ })
    await sourceButton.click()

    const textarea = page.locator('textarea')
    await textarea.fill('- [x] Task to uncheck')

    // Switch to preview mode
    const previewButton = page.locator('button').filter({ hasText: /^Preview$/ })
    await previewButton.click()

    // Verify initial state
    const checkbox = page.locator('.task-checkbox').first()
    await expect(checkbox).toBeChecked()

    // Click to uncheck
    await checkbox.click()

    // Wait a bit for state to update
    await page.waitForTimeout(300)

    // Wait for React to re-render and then verify checkbox is unchecked
    await page.waitForTimeout(500)
    await expect(checkbox).not.toBeChecked()

    // Switch back to source mode to verify markdown was updated
    await sourceButton.click()
    await expect(textarea).toHaveValue('- [ ] Task to uncheck')
  })

  test('should toggle multiple checkboxes correctly', async ({ page }) => {
    // Switch to source mode and add multiple tasks
    const sourceButton = page.locator('button').filter({ hasText: /^Source$/ })
    await sourceButton.click()

    const textarea = page.locator('textarea')
    await textarea.fill(`- [ ] Task 1
- [x] Task 2
- [ ] Task 3`)

    // Switch to preview mode
    const previewButton = page.locator('button').filter({ hasText: /^Preview$/ })
    await previewButton.click()

    // Get all checkboxes
    const checkbox1 = page.locator('.task-checkbox').nth(0)
    const checkbox2 = page.locator('.task-checkbox').nth(1)
    const checkbox3 = page.locator('.task-checkbox').nth(2)

    // Verify initial states
    await expect(checkbox1).not.toBeChecked()
    await expect(checkbox2).toBeChecked()
    await expect(checkbox3).not.toBeChecked()

    // Toggle Task 1 (unchecked -> checked)
    await checkbox1.click()
    await page.waitForTimeout(500)
    await expect(checkbox1).toBeChecked()

    // Toggle Task 2 (checked -> unchecked)
    await checkbox2.click()
    await page.waitForTimeout(500)
    await expect(checkbox2).not.toBeChecked()

    // Toggle Task 3 (unchecked -> checked)
    await checkbox3.click()
    await page.waitForTimeout(500)
    await expect(checkbox3).toBeChecked()

    // Verify final markdown
    await sourceButton.click()
    await expect(textarea).toHaveValue(`- [x] Task 1
- [ ] Task 2
- [x] Task 3`)
  })

  test('should toggle checkboxes in split mode', async ({ page }) => {
    // Switch to source mode and add task list
    const sourceButton = page.locator('button').filter({ hasText: /^Source$/ })
    await sourceButton.click()

    const textarea = page.locator('textarea')
    await textarea.fill(`- [ ] Task 1
- [x] Task 2`)

    // Switch to split mode
    const splitButton = page.locator('button').filter({ hasText: /^Split$/ })
    await splitButton.click()

    // Get checkbox in preview pane
    const checkbox = page.locator('.task-checkbox').first()
    await expect(checkbox).not.toBeChecked()

    // Click to check
    await checkbox.click()
    await page.waitForTimeout(200)

    // Verify checkbox is checked
    await expect(checkbox).toBeChecked()

    // Verify source is updated
    await expect(textarea).toHaveValue(`- [x] Task 1
- [x] Task 2`)
  })

  test('should handle task list with markdown formatting', async ({ page }) => {
    // Switch to source mode
    const sourceButton = page.locator('button').filter({ hasText: /^Source$/ })
    await sourceButton.click()

    const textarea = page.locator('textarea')
    await textarea.fill('- [ ] Task with **bold** text')

    // Switch to preview mode
    const previewButton = page.locator('button').filter({ hasText: /^Preview$/ })
    await previewButton.click()

    // Verify bold text is rendered
    await expect(page.locator('.task-content strong')).toHaveText('bold')

    // Toggle checkbox
    const checkbox = page.locator('.task-checkbox').first()
    await checkbox.click()
    await page.waitForTimeout(200)

    // Verify toggle worked
    await expect(checkbox).toBeChecked()
  })
})
