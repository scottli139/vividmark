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

vi.mock('../../mermaid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../mermaid')>()
  return { ...actual, renderMermaidSvg: vi.fn() }
})

describe('??? admonition (MkDocs collapsible syntax)', () => {
  it('renders an untitled note in a collapsed details element', () => {
    const html = parseMarkdown('??? note\n    Collapsed content.')

    expect(html).toContain('<details class="admonition note">')
    expect(html).toContain('<summary class="admonition-title">Note</summary>')
    expect(html).toContain('<div class="admonition-content">')
    expect(html).toContain('<p>Collapsed content.</p>')
    expect(html).toContain('</div></details>')
    expect(html.match(/<details[^>]*>/)?.[0]).toBe('<details class="admonition note">')
  })

  it('renders a custom quoted title', () => {
    const html = parseMarkdown('??? warning "Optional title"\n    Warning content.')

    expect(html).toContain('<details class="admonition warning">')
    expect(html).toContain('<summary class="admonition-title">Optional title</summary>')
    expect(html).toContain('Warning content.')
  })

  it('renders nested lists and fenced code inside the collapsible content', () => {
    const html = parseMarkdown(
      [
        '??? note "Nested content"',
        '    Intro text.',
        '',
        '    - First item',
        '    - Second item',
        '',
        '    ```ts',
        '    const answer = 42',
        '    ```',
      ].join('\n')
    )

    const detailsStart = html.indexOf('<details class="admonition note">')
    const contentStart = html.indexOf('<div class="admonition-content">', detailsStart)
    const detailsEnd = html.indexOf('</details>', detailsStart)
    const content = html.slice(contentStart, detailsEnd)

    expect(detailsStart).toBeGreaterThanOrEqual(0)
    expect(content).toContain('<li>First item</li>')
    expect(content).toContain('<li>Second item</li>')
    expect(content.replace(/<[^>]+>/g, '')).toContain('const answer = 42')
  })

  it('falls back to the note theme and original type label for unknown types', () => {
    const html = parseMarkdown('??? abstract\n    Abstract content.')

    expect(html).toContain('<details class="admonition note">')
    expect(html).toContain('<summary class="admonition-title">Abstract</summary>')
    expect(html).toContain('Abstract content.')
  })

  it('escapes HTML in a custom title', () => {
    const html = parseMarkdown('??? note "<img src=x>"\n    Safe content.')

    expect(html).toContain('<summary class="admonition-title">&lt;img src=x&gt;</summary>')
    expect(html).not.toContain('<summary class="admonition-title"><img')
  })

  it('renders collapsed admonitions through the async export parser', async () => {
    const html = await parseMarkdownAsync('??? tip\n    Export content.')

    expect(html).toContain('<details class="admonition tip">')
    expect(html).toContain('<summary class="admonition-title">Tip</summary>')
    expect(html).toContain('Export content.')
  })

  it('does not interpret malformed markers or marker text in fenced code', () => {
    const malformed = parseMarkdown('???? note\n    Not an admonition.')
    const fenced = parseMarkdown('```text\n??? note\n    Not an admonition.\n```')

    expect(malformed).not.toContain('<details')
    expect(fenced).not.toContain('<details')
    expect(fenced).toContain('??? note')
  })
})
