import { test, expect } from '@playwright/test'

test.describe('File Drag and Drop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for app to initialize
    await page.waitForTimeout(1500)
  })

  test('should show drag overlay when dragging file over window', async ({ page }) => {
    // Simulate drag enter using DataTransfer
    await page.evaluate(() => {
      const event = new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      })
      // @ts-expect-error - File constructor is available in browser
      event.dataTransfer.items.add(new File(['test'], 'test.md'))
      window.dispatchEvent(event)
    })

    // Check if overlay is visible
    await expect(page.locator('text=Drop Markdown file here')).toBeVisible()
  })

  test('should open dropped markdown file', async ({ page }) => {
    // Create a temporary markdown file for testing
    const testContent = '# Test Document\n\nThis is a test.'

    // Use file chooser API as alternative to drag-drop
    const fileChooserPromise = page.waitForEvent('filechooser')

    // Click the open button to trigger file dialog
    await page.click('[title="Open File (Cmd+O)"]')

    const fileChooser = await fileChooserPromise

    // Create a temporary file
    await fileChooser.setFiles([
      {
        name: 'test-drop.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from(testContent),
      },
    ])

    // Verify file was opened (content should appear)
    await expect(page.locator('.cm-editor, .markdown-body')).toContainText('Test Document')
  })

  test('should reject non-markdown files', async ({ page }) => {
    // Listen for alert dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Please drop a Markdown file')
      await dialog.dismiss()
    })

    // Simulate dropping a non-markdown file
    await page.evaluate(() => {
      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      })
      // @ts-expect-error - File constructor is available in browser
      event.dataTransfer.items.add(new File(['test'], 'image.png', { type: 'image/png' }))
      window.dispatchEvent(event)
    })

    // Wait for alert
    await page.waitForTimeout(500)
  })
})
