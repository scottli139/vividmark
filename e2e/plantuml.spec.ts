import { test, expect } from '@playwright/test'
import { presetSourceMode } from './sourceMode'
import { setViewMode } from './viewMode'

/**
 * PlantUML 本地渲染端到端测试（真实 @plantuml/core 引擎，首次加载数 MB 需放宽超时）。
 * 覆盖：fence 代码块 / @startuml 行内 → Preview 内联 SVG；WYSIWYG 双区渲染；
 *       全程拦截 plantuml.com 外发请求，证明离线渲染无网络依赖。
 */

// 本地渲染失败时会回退在线服务——拦截外发请求，若走到回退路径则测试失败
test.beforeEach(async ({ page }) => {
  await page.route('https://www.plantuml.com/**', (route) => route.abort())
})

async function typeInSourceMode(page: import('@playwright/test').Page, text: string) {
  await presetSourceMode(page)
  await page.goto('/')
  await page.waitForSelector('.cm-content')
  await page.locator('.cm-content').click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(text)
}

test.describe('PlantUML local rendering', () => {
  test('renders fenced plantuml block as inline SVG in Preview (offline)', async ({ page }) => {
    await typeInSourceMode(page, '```plantuml\n@startuml\nAlice -> Bob: hello\n@enduml\n```')
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .plantuml-diagram')
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60000 })
    // 无在线回退：不应出现 plantuml.com 的 img
    await expect(diagram.locator('img')).toHaveCount(0)
  })

  test('renders inline @startuml block as inline SVG in Preview (offline)', async ({ page }) => {
    await typeInSourceMode(page, '@startuml\nBob -> Carol: hi\n@enduml')
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .plantuml-diagram')
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60000 })
    await expect(diagram.locator('img')).toHaveCount(0)
  })

  test('renders diagram after switching view mode long after content settled', async ({ page }) => {
    // 回归：预览容器只在 preview/split 挂载；若 renderedHtml 在切换前已就绪，
    // 占位渲染 effect 必须随 viewMode 变化重跑（曾因此切换后图不显示）
    await typeInSourceMode(page, '```plantuml\n@startuml\nEve -> Frank: settled\n@enduml\n```')
    // 等 120ms 防抖 + 解析完成，确保 renderedHtml 在切换前已落地
    await page.waitForTimeout(500)
    await setViewMode(page, 'Preview')

    const diagram = page.locator('.markdown-body .plantuml-diagram')
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 60000 })
    await expect(diagram.locator('img')).toHaveCount(0)
  })

  test('renders WYSIWYG dual-pane preview with editable source (offline)', async ({ page }) => {
    await typeInSourceMode(page, '```plantuml\n@startuml\nDave -> Eve: yo\n@enduml\n```')
    await setViewMode(page, 'WYSIWYG')

    const block = page.locator('.ProseMirror .plantuml-block')
    await expect(block.locator('.plantuml-diagram svg')).toBeVisible({ timeout: 60000 })
    // 双区：源码仍可编辑（pre>code 保留在 contentDOM）
    await expect(block.locator('pre code')).toContainText('@startuml')
    await expect(block.locator('.plantuml-diagram img')).toHaveCount(0)
  })
})
