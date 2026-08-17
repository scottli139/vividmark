import { describe, it, expect } from 'vitest'
import type { FileTreeItem } from '../fileTreeUtils'
import {
  addHeadingIds,
  buildNavFromMkdocsNav,
  buildNavModel,
  collectPublicAssets,
  collectSiteEntries,
  compareNavNames,
  createSlugger,
  filterFileTreeByExcludes,
  isMarkdownFile,
  mdHrefToHtml,
  mdToHtmlPath,
  pageTitleFromMarkdown,
  relPrefix,
  renderNavHtml,
  rewriteMarkdownLinks,
  slugifyHeading,
  stripOrderPrefix,
  type SiteFileEntry,
} from '../siteGenerator'
import type { MkdocsNavItem } from '../siteConfig'
import { compileExcludePatterns } from '../siteConfig'

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
    // frontmatter 场景的行为变更见下方「pageTitleFromMarkdown 跳过 frontmatter」describe
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

// ==================== mkdocs nav 驱动导航（配置感知，见 site-export-config-plan.md） ====================

describe('buildNavFromMkdocsNav', () => {
  const pages: SiteFileEntry[] = [
    { sourcePath: '/repo/docs/svcsdk/README.md', relPath: 'svcsdk/README.md' },
    { sourcePath: '/repo/docs/svcsdk/win.md', relPath: 'svcsdk/win.md' },
    { sourcePath: '/repo/docs/README.md', relPath: 'README.md' },
    { sourcePath: '/repo/docs/hidden/notes.md', relPath: 'hidden/notes.md' },
  ]

  const mkdocsNav: MkdocsNavItem[] = [
    { title: '首页', path: 'svcsdk/README.md' },
    {
      title: '会捷通 SDK (SVC)',
      children: [{ title: 'Windows 版本 (C++)', path: 'svcsdk/win.md' }],
    },
    { title: '公司主页', url: 'http://www.hexmeet.com' },
  ]

  it('标题/顺序/分组照抄 nav 原文，路径映射 htmlPath，外链成 external 条目', () => {
    const { nav, missingPaths } = buildNavFromMkdocsNav(mkdocsNav, pages)
    expect(missingPaths).toEqual([])
    expect(nav.entries.map((e) => e.type)).toEqual(['page', 'dir', 'external'])
    // README.md → 所在目录 index.html
    expect(nav.entries[0]).toMatchObject({ title: '首页', htmlPath: 'svcsdk/index.html' })
    expect(nav.entries[1].children?.[0]).toMatchObject({
      title: 'Windows 版本 (C++)',
      htmlPath: 'svcsdk/win.html',
    })
    expect(nav.entries[2]).toMatchObject({
      title: '公司主页',
      externalUrl: 'http://www.hexmeet.com',
    })
    // 重定向首页目标 = nav 第一个页面
    expect(nav.firstHtmlPath).toBe('svcsdk/index.html')
  })

  it('未收录页面不进导航（策展白名单，不追加）', () => {
    const { nav } = buildNavFromMkdocsNav(mkdocsNav, pages)
    const html = renderNavHtml(nav.entries, 'svcsdk/index.html')
    expect(html).not.toContain('hidden/')
    expect(html).not.toContain('隐藏')
  })

  it('homeHtmlPath 以页面集为准：根 README 存在即有，无论是否在 nav', () => {
    const { nav } = buildNavFromMkdocsNav(mkdocsNav, pages)
    expect(nav.homeHtmlPath).toBe('index.html')
    const withoutRootReadme = pages.filter((p) => p.relPath !== 'README.md')
    expect(buildNavFromMkdocsNav(mkdocsNav, withoutRootReadme).nav.homeHtmlPath).toBeNull()
  })

  it('nav 指向的文件不存在 → 跳过并记入 missingPaths；组内全缺失整组跳过', () => {
    const nav: MkdocsNavItem[] = [
      { title: '有效', path: 'svcsdk/win.md' },
      { title: '缺失', path: 'ghost.md' },
      { title: '全缺失组', children: [{ title: '也缺失', path: 'ghost2.md' }] },
    ]
    const { nav: model, missingPaths } = buildNavFromMkdocsNav(nav, pages)
    expect(missingPaths).toEqual(['ghost.md', 'ghost2.md'])
    expect(model.entries).toHaveLength(1)
    expect(model.entries[0].title).toBe('有效')
  })

  it('nav 无页面时 firstHtmlPath 退回页面集第一个', () => {
    const nav: MkdocsNavItem[] = [{ title: '外链', url: 'https://a.com' }]
    const { nav: model } = buildNavFromMkdocsNav(nav, pages)
    expect(model.firstHtmlPath).toBe('svcsdk/index.html')
  })
})

describe('renderNavHtml external 条目', () => {
  it('新窗口打开 + 外链样式 + rel 安全属性', () => {
    const html = renderNavHtml(
      [{ type: 'external', title: '公司主页', externalUrl: 'https://www.hexmeet.com' }],
      'index.html'
    )
    expect(html).toContain('href="https://www.hexmeet.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('class="external"')
  })
})

describe('pageTitleFromMarkdown 跳过 frontmatter', () => {
  it('frontmatter 后的 H1 正常提取', () => {
    expect(pageTitleFromMarkdown('---\ntitle: x\n---\n# 真标题\n正文')).toBe('真标题')
  })

  it('frontmatter 不再被误认为正文内容（无 H1 返回 null）', () => {
    expect(pageTitleFromMarkdown('---\ntitle: x\n---\n正文第一段')).toBeNull()
  })
})

describe('filterFileTreeByExcludes（mkdocs exclude_docs）', () => {
  const tree: FileTreeItem[] = [
    file('index.md'),
    file('secret.md'),
    dir('drafts', [file('a.md', 'drafts'), file('notes.txt', 'drafts')]),
    dir('guide', [file('intro.md', 'guide'), file('debug.log', 'guide')]),
    file('logo.png'),
  ]

  it('页面与资产同滤；目录保留、空目录自然无产物', () => {
    const filtered = filterFileTreeByExcludes(
      tree,
      compileExcludePatterns(['/secret.md', 'drafts/', '*.log'])
    )
    const { pages, assets } = collectSiteEntries(filtered)
    expect(pages.map((p) => p.relPath)).toEqual(['index.md', 'guide/intro.md'])
    expect(assets.map((a) => a.relPath)).toEqual(['logo.png'])
  })

  it('! 取反重新纳入个别文件', () => {
    const filtered = filterFileTreeByExcludes(tree, compileExcludePatterns(['*.md', '!/index.md']))
    const { pages } = collectSiteEntries(filtered)
    expect(pages.map((p) => p.relPath)).toEqual(['index.md'])
  })

  it('空模式列表原样返回', () => {
    expect(filterFileTreeByExcludes(tree, [])).toBe(tree)
  })
})

describe('collectPublicAssets（vuepress .vuepress/public）', () => {
  it('全部文件（含 .md）都是资产，relPath 相对 public 根', () => {
    const tree: FileTreeItem[] = [
      file('logo.png'),
      file('index.md'),
      dir('img', [file('hero.png', 'img')]),
    ]
    expect(collectPublicAssets(tree)).toEqual([
      { sourcePath: '/docs/logo.png', relPath: 'logo.png' },
      { sourcePath: '/docs/index.md', relPath: 'index.md' },
      { sourcePath: '/docs/img/hero.png', relPath: 'img/hero.png' },
    ])
  })

  it('空树 → 空列表', () => {
    expect(collectPublicAssets([])).toEqual([])
  })
})
