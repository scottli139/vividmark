import { test, expect } from '@playwright/test'
import { presetSourceMode } from './sourceMode'
import { setViewMode } from './viewMode'

/**
 * 内联 html `<br>` 换行端到端测试
 *
 * GFM 表格单元格常用 `<br>` 换行写法（GitHub 同款）。WYSIWYG 侧由 htmlView
 * 渲染为真实 <br data-type="html">（其余内联 html 维持字面 span[data-type="html"]），
 * 序列化走 attrs.value 原文，切回源码内容不变。
 */

const DOC_LINES = [
  '| method | 说明 |',
  '| --- | --- |',
  '| login | 第一行<br>第二行 |',
  '',
  'a <b>bold</b> c',
]

test.beforeEach(async ({ page }) => {
  await presetSourceMode(page)
  await page.goto('/')
  await expect(page.getByTestId('statusbar-viewmode')).toBeVisible()
  await page.waitForSelector('.cm-content')

  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  for (let i = 0; i < DOC_LINES.length; i++) {
    if (i > 0) await page.keyboard.press('Enter')
    if (DOC_LINES[i]) await page.keyboard.type(DOC_LINES[i])
  }
})

test.describe('inline html <br>', () => {
  test('table cell <br> renders as real line break in WYSIWYG', async ({ page }) => {
    await setViewMode(page, 'WYSIWYG')
    const pm = page.locator('.ProseMirror')

    // <br> 渲染为真实换行元素（带 htmlView 回读属性），不再显示字面文本
    await expect(pm.locator('br[data-type="html"][data-value="<br>"]')).toHaveCount(1)
    expect(await pm.textContent()).not.toContain('<br>')
    // 单元格内两段文字都在
    await expect(pm.locator('td', { hasText: '第一行' })).toContainText('第二行')
  })

  test('other inline html stays literal in WYSIWYG', async ({ page }) => {
    await setViewMode(page, 'WYSIWYG')
    const pm = page.locator('.ProseMirror')

    // <b> / </b> 维持字面显示（span[data-type="html"]），不渲染为加粗
    await expect(pm.locator('span[data-type="html"]')).toHaveCount(2)
    await expect(pm.locator('strong', { hasText: 'bold' })).toHaveCount(0)
  })

  test('round-trips back to source unchanged', async ({ page }) => {
    await setViewMode(page, 'WYSIWYG')
    await expect(page.locator('br[data-type="html"]')).toHaveCount(1)

    await setViewMode(page, 'Source')
    const content = await page.locator('.cm-content').textContent()
    expect(content).toContain('第一行<br>第二行')
    expect(content).toContain('a <b>bold</b> c')
  })
})
