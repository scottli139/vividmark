// 生成 README 用的应用截图（需要 dev server 运行在 localhost:5173）
// 用法: pnpm dev &  node scripts/take-screenshots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const OUT = new URL('../docs/images/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const DEMO = [
  '# VividMark',
  '',
  'A **Typora-like** WYSIWYG Markdown editor. Write *Markdown* and see it rendered `instantly`.',
  '',
  '::: tip MkDocs Ready',
  'Admonitions, PlantUML diagrams and tables work out of the box.',
  ':::',
  '',
  '## Task List',
  '',
  '- [x] Real-time WYSIWYG editing',
  '- [x] Dark mode & i18n',
  '- [ ] Your next document',
  '',
  '## Table',
  '',
  '| Feature     | Status |',
  '|:------------|:------:|',
  '| WYSIWYG     |   ✅   |',
  '| Split view  |   ✅   |',
  '| PDF Export  |   ✅   |',
  '',
  '## Code',
  '',
  '```rust',
  'fn main() {',
  '    println!("Hello, VividMark!");',
  '}',
  '```',
  '',
  '> Distraction-free writing, powered by Tauri 2 + React 19.',
  '',
].join('\n')

function preset(page, state) {
  return page.addInitScript((s) => {
    window.localStorage.setItem('vividmark-storage', JSON.stringify({ state: s, version: 1 }))
  }, state)
}

async function loadDemo(page, state) {
  await preset(page, state)
  await page.goto(BASE)
  await page.waitForSelector('.cm-editor', { timeout: 20000 })
  await page.click('.cm-content')
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.insertText(DEMO)
  await page.waitForTimeout(300)
}

const browser = await chromium.launch()

async function shot(name, state, after) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  await loadDemo(page, state)
  if (after) await after(page)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}${name}` })
  console.log('saved', name)
  await ctx.close()
}

// 1. WYSIWYG 浅色（主图）
await shot(
  'screenshot-wysiwyg-light.png',
  { viewMode: 'source', themeMode: 'light', language: 'en' },
  async (page) => {
    await page.getByRole('button', { name: 'WYSIWYG', exact: true }).click()
    await page.waitForTimeout(1200)
  }
)

// 2. WYSIWYG 深色
await shot(
  'screenshot-wysiwyg-dark.png',
  { viewMode: 'source', themeMode: 'dark', language: 'en' },
  async (page) => {
    await page.getByRole('button', { name: 'WYSIWYG', exact: true }).click()
    await page.waitForTimeout(1200)
  }
)

// 3. Split 模式（源码 + 预览滚动同步）
await shot('screenshot-split-light.png', { viewMode: 'split', themeMode: 'light', language: 'en' })

await browser.close()
console.log('done')
