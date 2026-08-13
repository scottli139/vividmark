import { test, expect } from '@playwright/test'
import { presetSourceMode } from './sourceMode'

/**
 * 数学公式（KaTeX）端到端测试
 * 覆盖：input rule 输入转公式节点、nodeview 点击编辑提交、Cmd+/ 切源码内容一致、
 *       表格内公式行高（PM separator/trailingBreak 光标辅助元素不得撑高单元格）
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[title="WYSIWYG"]')).toBeVisible()
})

test.describe('Math (KaTeX)', () => {
  test('typing $...$ converts to math node via input rule', async ({ page }) => {
    const proseMirror = page.locator('.ProseMirror')
    await proseMirror.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('$e=mc^2$')

    // input rule：闭合 $ 输入后应立即渲染为公式节点
    await expect(proseMirror.locator('.math-inline .katex')).toBeVisible()
  })

  test('click math node opens editor, blur commits to source', async ({ page }) => {
    const proseMirror = page.locator('.ProseMirror')
    await proseMirror.click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('$e=mc^2$')
    await expect(proseMirror.locator('.math-inline')).toBeVisible()

    // 点击进入编辑态，修改 LaTeX 源码
    await proseMirror.locator('.math-inline .math-preview').click()
    const mathEditor = proseMirror.locator('.math-editor')
    await expect(mathEditor).toBeVisible()
    await mathEditor.fill('x^2+y^2=z^2')

    // 点击编辑器容器空白处触发 blur 提交（.ProseMirror 高度仅内容高，空白区在父容器上）
    await page.locator('.markdown-body.wysiwyg-editor').click({ position: { x: 40, y: 300 } })
    await expect(mathEditor).toBeHidden()

    // 切到 Source 模式验证 markdown 内容已更新
    await page.keyboard.press('ControlOrMeta+/')
    await expect(page.locator('.cm-editor')).toBeVisible()
    await expect(page.locator('.cm-content')).toContainText('$x^2+y^2=z^2$')
  })

  test('math in table cell does not inflate row height', async ({ page }) => {
    await presetSourceMode(page)
    await page.reload()
    await page.waitForSelector('.cm-content')

    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('| A | B |')
    await page.keyboard.press('Enter')
    await page.keyboard.type('| --- | --- |')
    await page.keyboard.press('Enter')
    await page.keyboard.type('| x | $S=1$ |')

    await page.click('[title="WYSIWYG"]')
    await expect(page.locator('.math-inline')).toBeVisible()

    // PM 为 atom 行内节点插入的 separator/trailingBreak 曾把行高撑到 ~80px（两行空白）；
    // 修复后应回到单行高度（纯文本对照行约 43px）
    const { mathRowHeight, textRowHeight } = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.wysiwyg-editor table tr'))
      const mathTd = document.querySelector('.math-inline')!.closest('td')!
      return {
        mathRowHeight: mathTd.closest('tr')!.getBoundingClientRect().height,
        textRowHeight: rows[0].getBoundingClientRect().height,
      }
    })
    expect(mathRowHeight).toBeLessThan(textRowHeight + 12)
  })
})
