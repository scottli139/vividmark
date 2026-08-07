import { test, expect } from '@playwright/test'

/**
 * WYSIWYG 模式端到端测试（小而稳）
 * 覆盖：模式切换、输入即时渲染（input rule）、工具栏 Bold 接线、Cmd+/ 往返源码一致
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // 等待应用就绪（工具栏可见）
  await expect(page.locator('[title="WYSIWYG"]')).toBeVisible()
})

test.describe('WYSIWYG Mode', () => {
  test('enters wysiwyg mode by default', async ({ page }) => {
    // 默认视图模式即所见即所得：无需点击，Milkdown 编辑器直接可见
    await expect(page.locator('.ProseMirror')).toBeVisible()
    // CodeMirror 保持挂载但隐藏
    await expect(page.locator('.cm-editor')).toBeHidden()
  })

  test('typing markdown syntax renders as rich text', async ({ page }) => {
    await page.click('[title="WYSIWYG"]')

    const proseMirror = page.locator('.ProseMirror')
    await expect(proseMirror).toBeVisible()

    // 全选清空默认内容后输入标题
    await proseMirror.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('# Hello')

    // input rule：'# ' 应立即渲染为 h1
    await expect(proseMirror.locator('h1')).toHaveText('Hello')

    // 回车新段落后输入任务列表语法
    await page.keyboard.press('Enter')
    await page.keyboard.type('- [ ] task one')
    await expect(proseMirror.locator('.task-checkbox')).toHaveCount(1)
  })

  test('Cmd+B applies strong mark in wysiwyg', async ({ page }) => {
    await page.click('[title="WYSIWYG"]')

    const proseMirror = page.locator('.ProseMirror')
    await proseMirror.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('bold text')

    // 选中全部文本后按 Cmd/Ctrl+B（浏览器下走 Milkdown 自带 keymap；桌面端由格式菜单驱动）
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+b')

    await expect(proseMirror.locator('strong')).toHaveText('bold text')
  })

  test('Cmd+/ round-trips between wysiwyg and source with identical content', async ({
    page,
  }) => {
    await page.click('[title="WYSIWYG"]')

    const proseMirror = page.locator('.ProseMirror')
    await proseMirror.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('# Hello')
    await page.keyboard.press('Enter')
    await page.keyboard.type('some bold')

    // 全选后 Bold：两段都加上 strong
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('ControlOrMeta+b')
    await expect(proseMirror.locator('strong')).toHaveCount(2)

    // Cmd+/ 切回 source，断言源码内容一致
    await page.keyboard.press('ControlOrMeta+/')
    const cmContent = page.locator('.cm-content')
    await expect(cmContent).toBeVisible()
    await expect(cmContent).toContainText('# **Hello**')
    await expect(cmContent).toContainText('**some bold**')

    // 再 Cmd+/ 回到 wysiwyg，渲染保持一致
    await page.keyboard.press('ControlOrMeta+/')
    await expect(proseMirror.locator('h1')).toBeVisible()
    await expect(proseMirror.locator('strong').first()).toHaveText('Hello')
  })
})
