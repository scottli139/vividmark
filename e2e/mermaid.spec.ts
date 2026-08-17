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
})
