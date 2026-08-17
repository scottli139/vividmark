/**
 * 脚注（Footnotes）预览/分栏渲染测试（markdown-it-footnote）
 *
 * 引用 `[^id]` → `<sup class="footnote-ref">`（按引用首现顺序编号，同一
 * 定义的多次引用统一显示 [N]——覆写了 caption，默认 [N:M] 形态不采用）；
 * 定义 `[^id]:` 集中渲染到文末 `.footnotes` 区块（与源码书写位置无关），
 * 回链 `↩︎` 指回各引用锚点。未引用定义不渲染（同 GitHub）；
 * 悬空引用保持字面文本。
 */
import { describe, it, expect, vi } from 'vitest'
import { parseMarkdown, parseMarkdownAsync } from '../parser'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost${path}`),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
}))

vi.mock('../../plantuml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../plantuml')>()
  return { ...actual, renderPlantUmlSvg: vi.fn() }
})

describe('脚注（Footnotes）预览渲染', () => {
  it('基本引用与定义：角标 + 文末区块 + 回链', () => {
    const html = parseMarkdown('正文引用[^1]。\n\n[^1]: 脚注内容。')
    expect(html).toContain('<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup>')
    expect(html).toContain('<hr class="footnotes-sep">')
    expect(html).toContain('<section class="footnotes">')
    expect(html).toContain('<li id="fn1" class="footnote-item">')
    expect(html).toContain('脚注内容。')
    expect(html).toContain('<a href="#fnref1" class="footnote-backref">↩︎</a>')
  })

  it('命名标识符：[^note] 同样编号渲染', () => {
    const html = parseMarkdown('引用[^note]。\n\n[^note]: 命名脚注。')
    expect(html).toContain('href="#fn1"')
    expect(html).toContain('<li id="fn1" class="footnote-item">')
    expect(html).toContain('命名脚注。')
  })

  it('同一引用多次出现：统一显示 [N]，回链锚点各自独立', () => {
    const html = parseMarkdown('首次[^1]，再次[^1]。\n\n[^1]: 共享定义。')
    // caption 覆写：第二次引用也显示 [1]（默认会是 [1:1]）
    const refMatches = html.match(/<a href="#fn1" id="fnref1(:1)?">\[1\]<\/a>/g)
    expect(refMatches).toHaveLength(2)
    expect(html).toContain('id="fnref1:1"')
    // 两个回链分别指回两个引用锚点
    expect(html).toContain('<a href="#fnref1" class="footnote-backref">↩︎</a>')
    expect(html).toContain('<a href="#fnref1:1" class="footnote-backref">↩︎</a>')
    // 定义只有一条
    expect(html.match(/class="footnote-item"/g)).toHaveLength(1)
  })

  it('编号按引用首现顺序（与定义书写顺序无关）', () => {
    const html = parseMarkdown('先引[^b]后引[^a]。\n\n[^a]: 定义 A。\n\n[^b]: 定义 B。')
    const bRef = html.indexOf('id="fnref1"')
    const aRef = html.indexOf('id="fnref2"')
    expect(bRef).toBeGreaterThan(-1)
    expect(aRef).toBeGreaterThan(bRef)
    // 文末区块按编号序：fn1 = 定义 B，fn2 = 定义 A
    const fn1 = html.indexOf('id="fn1"')
    const fn2 = html.indexOf('id="fn2"')
    expect(html.indexOf('定义 B。')).toBeGreaterThan(fn1)
    expect(html.indexOf('定义 A。')).toBeGreaterThan(fn2)
  })

  it('未被引用的定义不渲染（同 GitHub 口径）', () => {
    const html = parseMarkdown('正文无引用。\n\n[^unused]: 孤立定义。')
    expect(html).not.toContain('孤立定义')
    expect(html).not.toContain('footnotes')
  })

  it('悬空引用（无定义）保持字面文本', () => {
    const html = parseMarkdown('引用[^nope]无效。')
    expect(html).toContain('[^nope]')
    expect(html).not.toContain('footnote-ref')
  })

  it('多行定义（4 空格缩进续行）合并为同一条目', () => {
    const html = parseMarkdown('引用[^1]。\n\n[^1]: 第一行\n    续行内容。')
    const item = html.match(/<li id="fn1" class="footnote-item">([\s\S]*?)<\/li>/)
    expect(item).not.toBeNull()
    expect(item![1]).toContain('第一行')
    expect(item![1]).toContain('续行内容。')
  })

  it('定义内的行内格式正常渲染', () => {
    const html = parseMarkdown('引用[^1]。\n\n[^1]: **加粗** 与 `代码`。')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<code>代码</code>')
  })

  it('定义集中渲染到文末（与源码书写位置无关）', () => {
    const html = parseMarkdown('引用[^1]。\n\n[^1]: 提前书写的定义。\n\n后续段落。')
    const defPos = html.indexOf('提前书写的定义。')
    const tailPos = html.indexOf('后续段落。')
    expect(defPos).toBeGreaterThan(tailPos)
  })

  it('同一 md 实例连续渲染互不影响（env 计数隔离）', () => {
    const first = parseMarkdown('甲[^1]。\n\n[^1]: 文档一脚注。')
    const second = parseMarkdown('乙[^x]。\n\n[^x]: 文档二脚注。')
    expect(first).toContain('id="fn1"')
    // 第二次渲染编号重新从 1 开始，不延续上次
    expect(second).toContain('id="fn1"')
    expect(second).toContain('文档二脚注。')
  })

  it('异步路径（导出/预览实际入口）同样渲染脚注', async () => {
    const html = await parseMarkdownAsync('引用[^1]。\n\n[^1]: 异步脚注。')
    expect(html).toContain('<sup class="footnote-ref">')
    expect(html).toContain('异步脚注。')
  })
})
