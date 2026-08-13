import { describe, it, expect } from 'vitest'
import type { FileTreeItem } from '../fileTreeUtils'
import {
  addHeadingIds,
  buildNavModel,
  collectSiteEntries,
  compareNavNames,
  createSlugger,
  isMarkdownFile,
  mdHrefToHtml,
  mdToHtmlPath,
  pageTitleFromMarkdown,
  relPrefix,
  renderNavHtml,
  rewriteMarkdownLinks,
  slugifyHeading,
  stripOrderPrefix,
} from '../siteGenerator'

function dir(name: string, children: FileTreeItem[]): FileTreeItem {
  return { name, path: `/docs/${name}`, isDirectory: true, children }
}
function file(name: string, parent = ''): FileTreeItem {
  return { name, path: `/docs/${parent ? `${parent}/` : ''}${name}`, isDirectory: false }
}

const sampleTree: FileTreeItem[] = [
  dir('01-guide', [
    file('02-advanced.md', '01-guide'),
    file('README.md', '01-guide'),
    file('01-getting-started.md', '01-guide'),
  ]),
  file('02-api.md'),
  file('README.md'),
  dir('images', [file('logo.png', 'images')]),
]

describe('isMarkdownFile', () => {
  it('识别 md/markdown，大小写不敏感', () => {
    expect(isMarkdownFile('a.md')).toBe(true)
    expect(isMarkdownFile('a.MARKDOWN')).toBe(true)
    expect(isMarkdownFile('a.png')).toBe(false)
    expect(isMarkdownFile('a.md.txt')).toBe(false)
  })
})

describe('stripOrderPrefix / compareNavNames', () => {
  it('剥离数字前缀', () => {
    expect(stripOrderPrefix('01-intro.md')).toBe('intro.md')
    expect(stripOrderPrefix('02_guide')).toBe('guide')
    expect(stripOrderPrefix('03.intro')).toBe('intro')
    expect(stripOrderPrefix('intro')).toBe('intro')
  })

  it('排序：index 页最前 → 数字前缀 → 名称', () => {
    const names = ['b.md', '10-x.md', '02-b.md', 'README.md', '01-a.md']
    expect([...names].sort(compareNavNames)).toEqual([
      'README.md',
      '01-a.md',
      '02-b.md',
      '10-x.md',
      'b.md',
    ])
  })
})

describe('mdToHtmlPath', () => {
  it('普通页面换扩展名', () => {
    expect(mdToHtmlPath('api.md')).toBe('api.html')
    expect(mdToHtmlPath('guide/intro.markdown')).toBe('guide/intro.html')
    expect(mdToHtmlPath('a/b/c.md')).toBe('a/b/c.html')
  })

  it('README/index 映射为所在目录的 index.html（大小写不敏感）', () => {
    expect(mdToHtmlPath('README.md')).toBe('index.html')
    expect(mdToHtmlPath('index.markdown')).toBe('index.html')
    expect(mdToHtmlPath('guide/README.MD')).toBe('guide/index.html')
    expect(mdToHtmlPath('guide/index.md')).toBe('guide/index.html')
  })
})

describe('collectSiteEntries', () => {
  it('md 为页面、其余为资产，目录递归展开', () => {
    const { pages, assets } = collectSiteEntries(sampleTree)
    expect(pages.map((p) => p.relPath).sort()).toEqual([
      '01-guide/01-getting-started.md',
      '01-guide/02-advanced.md',
      '01-guide/README.md',
      '02-api.md',
      'README.md',
    ])
    expect(assets).toEqual([{ sourcePath: '/docs/images/logo.png', relPath: 'images/logo.png' }])
  })
})

describe('pageTitleFromMarkdown', () => {
  it('提取首个 H1', () => {
    expect(pageTitleFromMarkdown('# Hello World\n\ntext')).toBe('Hello World')
    expect(pageTitleFromMarkdown('\n\n# 标题\ncontent')).toBe('标题')
    expect(pageTitleFromMarkdown('# Title ##\n')).toBe('Title')
  })

  it('无 H1 或 H2 在前时返回 null', () => {
    expect(pageTitleFromMarkdown('no heading')).toBeNull()
    expect(pageTitleFromMarkdown('## Sub\n# Later')).toBeNull()
    expect(pageTitleFromMarkdown('---\nfrontmatter\n---\n# Title')).toBeNull()
  })
})

describe('buildNavModel', () => {
  it('生成层级导航，应用排序与标题回退', () => {
    const titles = new Map([['/docs/README.md', 'SDK 文档']])
    const nav = buildNavModel(sampleTree, titles)

    // 根级：README（index 页）最前，其余按数字前缀；纯资产目录不进导航
    expect(nav.entries).toHaveLength(3)
    const [home, guide, api] = nav.entries
    expect(home).toMatchObject({ type: 'page', title: 'SDK 文档', htmlPath: 'index.html' })
    expect(guide).toMatchObject({ type: 'dir', title: 'guide' })
    expect(api).toMatchObject({ type: 'page', title: 'api', htmlPath: '02-api.html' })

    // 目录内：README 最前且用目录名做回退标题，其余按数字前缀
    expect(guide.children!.map((c) => [c.title, c.htmlPath])).toEqual([
      ['guide', '01-guide/index.html'],
      ['getting-started', '01-guide/01-getting-started.html'],
      ['advanced', '01-guide/02-advanced.html'],
    ])
  })

  it('homeHtmlPath / firstHtmlPath', () => {
    const nav = buildNavModel(sampleTree)
    expect(nav.homeHtmlPath).toBe('index.html')
    expect(nav.firstHtmlPath).toBe('index.html')
  })

  it('根目录无 README/index 时 homeHtmlPath 为 null', () => {
    const nav = buildNavModel([file('a.md'), file('b.md')])
    expect(nav.homeHtmlPath).toBeNull()
    expect(nav.firstHtmlPath).toBe('a.html')
  })
})

describe('slugifyHeading / createSlugger', () => {
  it('GitHub 风格 slug', () => {
    expect(slugifyHeading('Hello World!')).toBe('hello-world')
    expect(slugifyHeading('快速开始（一）')).toBe('快速开始一')
    expect(slugifyHeading('API Reference: v2.0')).toBe('api-reference-v20')
    expect(slugifyHeading('  spaces  and_under-score ')).toBe('spaces-and_under-score')
  })

  it('重名标题追加序号去重', () => {
    const slug = createSlugger()
    expect(slug('Intro')).toBe('intro')
    expect(slug('Intro')).toBe('intro-1')
    expect(slug('Intro')).toBe('intro-2')
  })
})

describe('addHeadingIds', () => {
  it('给标题加 id 并去重，已有 id 保留', () => {
    const out = addHeadingIds('<h1>Hello World</h1><h2>Hello World</h2><h2 id="custom">X</h2>')
    expect(out).toContain('<h1 id="hello-world">')
    expect(out).toContain('<h2 id="hello-world-1">')
    expect(out).toContain('<h2 id="custom">')
  })
})

describe('mdHrefToHtml / rewriteMarkdownLinks', () => {
  it('md 路径映射', () => {
    expect(mdHrefToHtml('./a.md')).toBe('./a.html')
    expect(mdHrefToHtml('../b.markdown')).toBe('../b.html')
    expect(mdHrefToHtml('guide/README.md')).toBe('guide/index.html')
    expect(mdHrefToHtml('images/pic.png')).toBeNull()
  })

  it('重写相对 .md 链接，保留锚点', () => {
    const html = '<p><a href="./a.md">a</a> <a href="../b.md#安装">b</a></p>'
    const out = rewriteMarkdownLinks(html)
    expect(out).toContain('href="./a.html"')
    expect(out).toContain('href="../b.html#安装"')
  })

  it('外部链接、锚点、非 md 链接不动', () => {
    const html =
      '<a href="https://x.com/a.md">web</a><a href="#local">anchor</a>' +
      '<a href="mailto:a@b.c">mail</a><a href="./pic.png">img</a><a href="//cdn.x.com">cdn</a>'
    expect(rewriteMarkdownLinks(html)).toBe(html)
  })
})

describe('renderNavHtml', () => {
  const nav = buildNavModel(sampleTree, new Map([['/docs/README.md', 'SDK 文档']]))

  it('当前页 active + 相对前缀链接', () => {
    const html = renderNavHtml(nav.entries, '01-guide/01-getting-started.html')
    expect(html).toContain(
      '<a href="../01-guide/01-getting-started.html" class="active" aria-current="page">getting-started</a>'
    )
    expect(html).toContain('<a href="../index.html">SDK 文档</a>')
  })

  it('顶层目录展开，含当前页的分支展开', () => {
    const html = renderNavHtml(nav.entries, '02-api.html')
    // guide 是顶层目录 → open
    expect(html).toContain('<details open><summary>guide</summary>')
  })

  it('标题转义', () => {
    const entries = buildNavModel([file('a.md')], new Map([['/docs/a.md', 'A <B>']])).entries
    expect(renderNavHtml(entries, 'a.html')).toContain('A &lt;B&gt;')
  })
})

describe('relPrefix', () => {
  it('按目录深度生成 ../ 前缀', () => {
    expect(relPrefix('index.html')).toBe('')
    expect(relPrefix('guide/intro.html')).toBe('../')
    expect(relPrefix('a/b/c.html')).toBe('../../')
  })
})
