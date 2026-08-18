import { test, expect } from '@playwright/test'
import { presetSourceMode } from './sourceMode'
import { setViewMode } from './viewMode'

/**
 * Mermaid 本地渲染端到端测试（真实 mermaid.js，首个图表按需加载 chunk 较大，放宽超时）。
 * 覆盖：fence 代码块 → Preview 内联 SVG；语法错误 → 错误态（无在线回退）；
 *       WYSIWYG 双区渲染；暗色主题重渲染。
 */

async function typeInSourceMode(page: import('@playwright/test').Page, text: string) {
  await presetSourceMode(page)
  await page.goto('/')
  await page.waitForSelector('.cm-content')
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(text)
}

test.describe('Mermaid local rendering', () => {
  test('renders fenced mermaid block as inline SVG in Preview (offline)', async ({ page }) => {
    await typeInSourceMode(page, '```mermaid\ngraph TD; A-->B\n```')
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .mermaid-diagram')
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60000 })
    // 无错误态、无在线回退 img
    await expect(diagram.locator('.mermaid-error')).toHaveCount(0)
    await expect(diagram.locator('img')).toHaveCount(0)
  })

  test('shows error state for invalid mermaid source (no online fallback)', async ({ page }) => {
    await typeInSourceMode(page, '```mermaid\nflowchart TD\n  A[broken --> B{\n```')
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .mermaid-diagram')
    await expect(diagram.locator('.mermaid-error')).toBeVisible({ timeout: 60000 })
    await expect(diagram.locator('img')).toHaveCount(0)
  })

  test('renders diagram after switching view mode long after content settled', async ({ page }) => {
    // 回归：预览容器只在 preview/split 挂载；若 renderedHtml 在切换前已就绪，
    // 占位渲染 effect 必须随 viewMode 变化重跑（PlantUML 曾因此切换后图不显示）
    await typeInSourceMode(page, '```mermaid\ngraph LR; X-->Y\n```')
    // 等 120ms 防抖 + 解析完成，确保 renderedHtml 在切换前已落地
    await page.waitForTimeout(500)
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .mermaid-diagram')
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60000 })
  })

  test('renders WYSIWYG dual-pane preview with editable source (offline)', async ({ page }) => {
    await typeInSourceMode(page, '```mermaid\nsequenceDiagram\nAlice->>Bob: hi\n```')
    await setViewMode(page, 'WYSIWYG')

    const block = page.locator('.ProseMirror .mermaid-block')
    await expect(block.locator('.mermaid-diagram svg')).toBeVisible({ timeout: 60000 })
    // 双区：源码仍可编辑（pre>code 保留在 contentDOM）
    await expect(block.locator('pre code')).toContainText('sequenceDiagram')
    await expect(block.locator('.mermaid-diagram img')).toHaveCount(0)
  })

  test('keeps diagram outside pre/code so labels use mermaid font (no clipping)', async ({
    page,
  }) => {
    // 回归：占位符曾被默认 fence 包进 <pre><code>，pre 的等宽字体 !important 规则
    // 压进 SVG foreignObject，文字按等宽字体渲染、按 mermaid 字体测量 → 被裁断
    await typeInSourceMode(page, '```mermaid\ngraph TD; A[打开文档] --> B{有改动?}\n```')
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .mermaid-diagram')
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60000 })
    await expect(page.locator('.markdown-body pre .mermaid-diagram')).toHaveCount(0)
    const fontFamily = await page.evaluate(() => {
      const svg = document.querySelector('.markdown-body .mermaid-diagram svg')
      return svg ? getComputedStyle(svg).fontFamily : ''
    })
    expect(fontFamily).not.toContain('Courier')
  })

  test('keeps rendered SVG after zoom in/out', async ({ page }) => {
    // 回归：React 19 按对象 identity 比对 dangerouslySetInnerHTML，缩放引发的无关
    // 重渲染曾把预览 innerHTML 重置回占位符，渐进渲染出的 SVG 消失
    await typeInSourceMode(page, '```mermaid\ngraph TD; A-->B\n```')
    await setViewMode(page, 'Preview')

    const svg = page.locator('.markdown-body .mermaid-diagram svg')
    await expect(svg).toBeVisible({ timeout: 60000 })

    await page.keyboard.press('ControlOrMeta+Equal')
    await page.waitForTimeout(300)
    await expect(svg).toBeVisible()
    await expect(page.locator('.markdown-body .mermaid-loading')).toHaveCount(0)

    await page.keyboard.press('ControlOrMeta+Minus')
    await page.waitForTimeout(300)
    await expect(svg).toBeVisible()
  })

  test('opens fullscreen viewer on diagram click, zooms, resets and closes', async ({ page }) => {
    await typeInSourceMode(page, '```mermaid\ngraph TD; A-->B\n```')
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .mermaid-diagram')
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60000 })

    // 点击图表打开全屏查看器（克隆 svg 注入，显式像素尺寸 + fit 初始缩放）
    await diagram.locator('svg').click()
    const lightbox = page.locator('.image-lightbox')
    await expect(lightbox).toBeVisible()
    const content = lightbox.locator('.image-lightbox-content')
    await expect(content.locator('svg')).toBeVisible()
    const initialTransform = await content.evaluate((el) => el.style.transform)
    expect(initialTransform).toContain('scale(1)')
    await expect(lightbox.locator('.image-lightbox-scale')).toHaveText('100%')

    // 工具栏放大/重置联动 transform 与百分比
    await lightbox.getByRole('button', { name: 'Zoom in' }).click()
    await expect(lightbox.locator('.image-lightbox-scale')).toHaveText('125%')
    await lightbox.getByRole('button', { name: 'Reset zoom' }).click()
    await expect(lightbox.locator('.image-lightbox-scale')).toHaveText('100%')
    expect(await content.evaluate((el) => el.style.transform)).toBe(initialTransform)

    // Esc 关闭；再次打开后点击空白区域关闭
    await page.keyboard.press('Escape')
    await expect(lightbox).toHaveCount(0)

    await diagram.locator('svg').click()
    await expect(lightbox).toBeVisible()
    await lightbox.locator('.image-lightbox-viewport').click({ position: { x: 5, y: 5 } })
    await expect(lightbox).toHaveCount(0)
  })
})
