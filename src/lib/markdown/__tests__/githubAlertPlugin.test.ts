/**
 * GitHub Alerts（`> [!NOTE]`）预览/分栏渲染测试（markdown-it core rule）
 *
 * 产出结构与 `:::` 容器 / `!!!` bang 一致：`<div class="admonition">` 三段式，CSS 零适配。
 * 识别口径：blockquote 首段首行 `[!TYPE]` 独占一行（五类、大小写不敏感）；
 * 未知类型 / 同行跟文本 / 折叠标记 +/- / 非首行 → 普通引用块，原文保留。
 */
import { describe, it, expect, vi } from 'vitest'
import { parseMarkdown, parseMarkdownAsync } from '../parser'
import { matchAlertMarkerLine } from '../githubAlert'

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

describe('GitHub Alerts（> [!NOTE]）', () => {
  it('渲染五种类型为 admonition 结构', () => {
    for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
      const html = parseMarkdown(`> [!${type}]\n> 内容`)
      const lower = type.toLowerCase()
      expect(html).toContain(`<div class="admonition ${lower}">`)
      expect(html).toContain(
        `<div class="admonition-title">${lower.charAt(0).toUpperCase() + lower.slice(1)}</div>`
      )
      expect(html).toContain('<div class="admonition-content">')
      expect(html).toContain('内容')
    }
  })

  it('标记行被剥离（不出现在渲染结果中），不产出 blockquote', () => {
    const html = parseMarkdown('> [!NOTE]\n> 正文')
    expect(html).not.toContain('[!NOTE]')
    expect(html).not.toContain('<blockquote>')
  })

  it('类型名大小写不敏感（[!note] / [!Warning]）', () => {
    expect(parseMarkdown('> [!note]\n> 内容')).toContain('<div class="admonition note">')
    expect(parseMarkdown('> [!Warning]\n> 内容')).toContain('<div class="admonition warning">')
  })

  it('多行内容同段落（软换行保留）', () => {
    const html = parseMarkdown('> [!TIP]\n> 第一行\n> 第二行')
    expect(html).toContain('<div class="admonition tip">')
    expect(html).toContain('第一行')
    expect(html).toContain('第二行')
  })

  it('多段落与行内格式', () => {
    const html = parseMarkdown('> [!IMPORTANT]\n> 第一段 **加粗**\n>\n> 第二段 `code`')
    expect(html).toContain('第一段 <strong>加粗</strong>')
    expect(html).toContain('第二段 <code>code</code>')
    expect(html.match(/<p>/g)?.length).toBe(2)
  })

  it('内容支持列表', () => {
    const html = parseMarkdown('> [!WARNING]\n> - 条目一\n> - 条目二')
    expect(html).toContain('<div class="admonition warning">')
    expect(html).toContain('<li>条目一</li>')
    expect(html).toContain('<li>条目二</li>')
  })

  it('空 alert（仅标记行）仍渲染盒子', () => {
    const html = parseMarkdown('> [!CAUTION]')
    expect(html).toContain('<div class="admonition caution">')
    expect(html).toContain('<div class="admonition-content">')
  })

  it('嵌套引用内的 alert 正常渲染', () => {
    const html = parseMarkdown('> 外层\n> > [!NOTE]\n> > 内层内容')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('内层内容')
  })

  it('列表内的 alert 正常渲染', () => {
    const html = parseMarkdown('- 条目\n  > [!NOTE]\n  > 列表内提示')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('列表内提示')
  })

  it('标记行尾硬换行标记仍识别（WYSIWYG 往返产物）', () => {
    // WYSIWYG 行内软换行序列化为 `\`+换行，自家文件往返后标记行带 `\` 尾缀
    const html = parseMarkdown('> [!NOTE]\\\n> 往返内容')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('往返内容')
    expect(html).not.toContain('[!NOTE]')
  })

  it('开括号转义形态（`\\[!NOTE]`，WYSIWYG 保存产物）仍识别', () => {
    // Milkdown 序列化把 `[` 转义防误判链接；解码后文本相同，必须双端仍识别
    const html = parseMarkdown('> \\[!NOTE]\n> 转义内容')
    expect(html).toContain('<div class="admonition note">')
    expect(html).toContain('转义内容')
  })

  it('未知类型不识别（普通引用块，原文保留）', () => {
    const html = parseMarkdown('> [!ABSTRACT]\n> 摘要')
    expect(html).not.toContain('admonition')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('[!ABSTRACT]')
  })

  it('标记后同行跟文本不识别', () => {
    const html = parseMarkdown('> [!NOTE] 行内标题\n> 内容')
    expect(html).not.toContain('admonition note')
    expect(html).toContain('[!NOTE] 行内标题')
  })

  it('Obsidian 折叠标记 [!note]- / [!note]+ 不识别（原文保留）', () => {
    const collapsed = parseMarkdown('> [!note]-\n> 折叠内容')
    expect(collapsed).not.toContain('admonition')
    expect(collapsed).toContain('[!note]-')
    const expanded = parseMarkdown('> [!note]+\n> 展开内容')
    expect(expanded).not.toContain('admonition')
    expect(expanded).toContain('[!note]+')
  })

  it('标记不在首行不识别', () => {
    const html = parseMarkdown('> 前文\n> [!NOTE]\n> 内容')
    expect(html).not.toContain('admonition')
    expect(html).toContain('[!NOTE]')
  })

  it('首段之后段落里的标记不识别', () => {
    const html = parseMarkdown('> 第一段\n>\n> [!NOTE]\n> 内容')
    expect(html).not.toContain('admonition')
  })

  it('围栏代码块内的标记文本不渲染', () => {
    const html = parseMarkdown('```text\n> [!NOTE]\n> 不是提示框\n```')
    expect(html).not.toContain('<div class="admonition')
    expect(html).toContain('[!NOTE]')
  })

  it('普通引用块不受影响', () => {
    const html = parseMarkdown('> 普通引用\n> 第二行')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('admonition')
  })

  it('alert 之后的内容在盒子之外', () => {
    const html = parseMarkdown('> [!NOTE]\n> 框内\n\n框外')
    const contentIdx = html.indexOf('admonition-content')
    expect(html.indexOf('框外')).toBeGreaterThan(html.indexOf('</div></div>', contentIdx))
  })

  it('异步路径（导出共用）同样渲染', async () => {
    const html = await parseMarkdownAsync('> [!TIP]\n> 异步内容')
    expect(html).toContain('<div class="admonition tip">')
    expect(html).toContain('异步内容')
  })

  it('不影响 ::: 容器与 !!! bang 既有行为', () => {
    expect(parseMarkdown('::: tip\n冒号内容\n:::')).toContain('<div class="admonition tip">')
    expect(parseMarkdown('!!! note\n    bang 内容')).toContain('<div class="admonition note">')
  })
})

describe('matchAlertMarkerLine（共享纯函数）', () => {
  it('五类型命中并小写化', () => {
    expect(matchAlertMarkerLine('[!NOTE]')).toBe('note')
    expect(matchAlertMarkerLine('[!tip]')).toBe('tip')
    expect(matchAlertMarkerLine('[!Important]')).toBe('important')
    expect(matchAlertMarkerLine('[!WARNING]')).toBe('warning')
    expect(matchAlertMarkerLine('[!caution]')).toBe('caution')
  })

  it('允许尾部空白与硬换行反斜杠', () => {
    expect(matchAlertMarkerLine('[!NOTE]  ')).toBe('note')
    expect(matchAlertMarkerLine('[!NOTE]\t')).toBe('note')
    expect(matchAlertMarkerLine('[!NOTE]\\')).toBe('note')
    expect(matchAlertMarkerLine('[!NOTE] \\')).toBe('note')
  })

  it('不识别形态返回 null', () => {
    expect(matchAlertMarkerLine('[!FOO]')).toBeNull() // 未知类型
    expect(matchAlertMarkerLine('[!NOTE] 标题')).toBeNull() // 同行跟文本
    expect(matchAlertMarkerLine('[!note]-')).toBeNull() // 折叠标记
    expect(matchAlertMarkerLine('[!note]+')).toBeNull()
    expect(matchAlertMarkerLine(' [!NOTE]')).toBeNull() // 行首空白（缩进不属于标记行）
    expect(matchAlertMarkerLine('[!]')).toBeNull() // 空类型
    expect(matchAlertMarkerLine('[!123]')).toBeNull() // 数字类型
    expect(matchAlertMarkerLine('')).toBeNull()
  })
})
