// 生成 README 用的应用截图（需要 dev server 运行在 localhost:5173）
// 用法: pnpm dev &  node scripts/take-screenshots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const OUT = new URL('../docs/images/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

// 演示文档：一屏内覆盖核心特色 —— WYSIWYG、GitHub Alert、Mermaid、KaTeX、任务列表
const DEMO = [
  '# VividMark',
  '',
  'A **Typora-like** WYSIWYG editor — write *Markdown*, see it ==rendered instantly==.',
  '',
  '> [!TIP]',
  '> Admonitions, Mermaid diagrams and KaTeX math work out of the box.',
  '',
  '```mermaid',
  'flowchart LR',
  '    A[Write] --> B[Preview] --> C[Export]',
  '```',
  '',
  '$$',
  'E = mc^2',
  '$$',
  '',
  '- [x] Mermaid & PlantUML diagrams',
  '- [x] KaTeX math, footnotes & alerts',
  '- [ ] Your next document',
  '',
  '| Export | Format |',
  '|:-------|:-------|',
  '| PDF    | Print-quality, one click |',
  '| Site   | Deployable static site |',
  '',
].join('\n')

function preset(page, state) {
  return page.addInitScript((s) => {
    window.localStorage.setItem('vividmark-storage', JSON.stringify({ state: s, version: 1 }))
  }, state)
}

// 统一从 Source 模式录入内容（WYSIWYG 直输会触发输入规则），再经状态栏下拉切到目标模式
async function loadDemo(page, state, targetMode) {
  await preset(page, state)
  await page.goto(BASE)
  await page.waitForSelector('.cm-editor', { timeout: 20000 })
  await page.click('.cm-content')
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.insertText(DEMO)
  await page.waitForTimeout(300)
  await page.getByTestId('statusbar-viewmode').click()
  await page.getByRole('menuitemcheckbox', { name: targetMode }).click()
}

const browser = await chromium.launch()

async function shot(name, state, targetMode, readySelector) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  await loadDemo(page, state, targetMode)
  if (readySelector) await page.waitForSelector(readySelector, { timeout: 60000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}${name}` })
  console.log('saved', name)
  await ctx.close()
}

// 1. WYSIWYG 浅色（主图）：Mermaid 双区 nodeview 渲染完成再截
await shot(
  'screenshot-wysiwyg-light.png',
  { viewMode: 'source', themeMode: 'light', language: 'en' },
  'WYSIWYG',
  '.ProseMirror .mermaid-block .mermaid-diagram svg'
)

// 2. WYSIWYG 深色
await shot(
  'screenshot-wysiwyg-dark.png',
  { viewMode: 'source', themeMode: 'dark', language: 'en' },
  'WYSIWYG',
  '.ProseMirror .mermaid-block .mermaid-diagram svg'
)

// 3. Split 模式（源码 + 预览滚动同步）：预览侧 Mermaid 渲染完成再截
await shot(
  'screenshot-split-light.png',
  { viewMode: 'source', themeMode: 'light', language: 'en' },
  'Split',
  '.markdown-body .mermaid-diagram svg'
)

// 4. 图表全屏查看器（深色）：Preview 点击 Mermaid 图打开 lightbox
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  await loadDemo(page, { viewMode: 'source', themeMode: 'dark', language: 'en' }, 'Preview')
  const diagram = page.locator('.markdown-body .mermaid-diagram')
  await diagram.locator('svg').waitFor({ timeout: 60000 })
  await diagram.locator('svg').click()
  await page.waitForSelector('.image-lightbox .image-lightbox-content svg', { timeout: 10000 })
  const lightbox = page.locator('.image-lightbox')
  await lightbox.getByRole('button', { name: 'Zoom in' }).click()
  await lightbox.getByRole('button', { name: 'Zoom in' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}screenshot-viewer-dark.png` })
  console.log('saved screenshot-viewer-dark.png')
  await ctx.close()
}

await browser.close()
console.log('done')
