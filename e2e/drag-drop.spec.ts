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

  // 浏览器环境无 Tauri onDragDropEvent，拖放链路无法触发（与同文件另 2 条
  // 既有失败同根因）。断言已更新为自绘 React 弹窗形式，待 Tauri 环境可测后启用。
  test.skip('should reject non-markdown files', async ({ page }) => {
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

    // 自绘 React 弹窗（替代原生 alert）出现提示文案
    await expect(page.locator('.fixed.inset-0 >> text=Please drop a Markdown file')).toBeVisible()
    // 关闭弹窗
    await page.click('button:has-text("Close")')
    await expect(page.locator('.fixed.inset-0 >> text=Please drop a Markdown file')).toBeHidden()
  })
})
