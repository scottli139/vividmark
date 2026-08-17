/**
 * MkDocs `!!!` admonition 预览/分栏渲染测试（markdown-it 自写块级 rule）
 *
 * 产出结构与 `:::` 容器（markdown-it-container）一致：`<div class="admonition">` 三段式，
 * CSS 零适配。未知类型降级 note 主题但默认标题取原类型名（对齐 Python-Markdown）。
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

describe('!!! admonition（mkdocs 风格）', () => {
  it('渲染基本提示框（复用 ::: 的 HTML 结构）', () => {
    const html = parseMarkdown('!!! note\n    这是内容')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('<div class="admonition-title">Note</div>')
    expect(html).toContain('<div class="admonition-content">')
    expect(html).toContain('这是内容')
  })

  it('双引号标题剥引号显示', () => {
    const html = parseMarkdown('!!! warning "自定义标题"\n    内容')
    expect(html).toContain('<div class="admonition warning">')
    expect(html).toContain('<div class="admonition-title">自定义标题</div>')
  })

  it('单引号与无引号标题', () => {
    expect(parseMarkdown("!!! tip '单引号'\n    内容")).toContain(
      '<div class="admonition-title">单引号</div>'
    )
    expect(parseMarkdown('!!! tip 无引号标题\n    内容')).toContain(
      '<div class="admonition-title">无引号标题</div>'
    )
  })

  it('未知类型降级 note 主题，默认标题取原类型名', () => {
    const html = parseMarkdown('!!! abstract\n    摘要内容')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('<div class="admonition-title">Abstract</div>')
    expect(html).toContain('摘要内容')
  })

  it('类型名大小写不敏感（NOTE → note）', () => {
    expect(parseMarkdown('!!! NOTE\n    内容')).toContain('<div class="admonition note">')
  })

  it('多段内容（空行悬挂）', () => {
    const html = parseMarkdown('!!! note\n    第一段\n\n    第二段')
    expect(html).toContain('第一段')
    expect(html).toContain('第二段')
    expect(html.match(/<p>/g)?.length).toBe(2)
  })

  it('内容支持行内格式与列表', () => {
    const html = parseMarkdown('!!! note\n    **加粗** 文本\n\n    - 条目一\n    - 条目二')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<li>条目一</li>')
  })

  it('容器内围栏代码块（dedent 后正常高亮）', () => {
    const html = parseMarkdown('!!! note\n    说明\n\n    ```js\n    const a = 1\n    ```')
    expect(html).toContain('class="hljs"')
    // 高亮会把代码拆成 span，剥标签后比对文本
    expect(html.replace(/<[^>]+>/g, '')).toContain('const a = 1')
  })

  it('容器内围栏里的 @startuml 文本不被行内 PlantUML 替换破坏', () => {
    const html = parseMarkdown(
      '!!! note\n    ```text\n    @startuml\n    A -> B\n    @enduml\n    ```'
    )
    expect(html).not.toContain('data-plantuml-src')
    expect(html).toContain('@startuml')
    expect(html).toContain('A -&gt; B')
  })

  it('未缩进行结束容器', () => {
    const html = parseMarkdown('!!! note\n    框内\n框外')
    expect(html).toContain('框内')
    // 「框外」在 admonition-content 之外
    const contentIdx = html.indexOf('admonition-content')
    expect(html.indexOf('框外')).toBeGreaterThan(html.indexOf('</div></div>', contentIdx))
  })

  it('空容器（仅标记行）', () => {
    const html = parseMarkdown('!!! note')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('<div class="admonition-content">')
  })

  it('引用块内的 !!! 正常渲染', () => {
    const html = parseMarkdown('> !!! note\n>     引用内的提示')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('引用内的提示')
  })

  it('段落后无空行也可中断段落（与 ::: 容器行为一致）', () => {
    const html = parseMarkdown('前文\n!!! note\n    内容')
    expect(html).toContain('前文')
    expect(html).toContain('<div class="admonition note">')
  })

  it('嵌套 bang：内外两层都渲染', () => {
    const html = parseMarkdown('!!! note\n    外层\n\n    !!! tip "内层"\n        内层内容')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('<div class="admonition tip">')
    expect(html).toContain('内层内容')
  })

  it('??? 可折叠语法与 !!!! 不渲染（保持可读原文）', () => {
    const html = parseMarkdown('??? note\n    折叠内容')
    expect(html).not.toContain('admonition')
    expect(html).toContain('??? note')
    expect(parseMarkdown('!!!! note\n    文本')).not.toContain('admonition note')
  })

  it('围栏代码块内的 !!! 不渲染', () => {
    const html = parseMarkdown('```text\n!!! note\n    不是提示框\n```')
    expect(html).not.toContain('<div class="admonition note">')
    expect(html).toContain('!!! note')
  })

  it('异步路径（站点导出共用）同样渲染', async () => {
    const html = await parseMarkdownAsync('!!! tip\n    异步内容')
    expect(html).toContain('<div class="admonition tip">')
    expect(html).toContain('异步内容')
  })

  it('不影响 ::: 容器既有行为', () => {
    const html = parseMarkdown('::: tip\n冒号内容\n:::')
    expect(html).toContain('<div class="admonition tip">')
    expect(html).toContain('冒号内容')
  })
})
