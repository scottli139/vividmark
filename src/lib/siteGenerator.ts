import type { FileTreeItem } from './fileTreeUtils'
import { FRONTMATTER_BLOCK_RE, type MkdocsNavItem } from './siteConfig'

/**
 * 静态站点生成器（纯函数，可单测）。
 *
 * 「导出为网站」功能的核心逻辑：把打开目录的 Markdown 文档树映射为镜像结构的
 * HTML 站点（guide/intro.md → guide/intro.html），非 Markdown 资产按原相对位置
 * 复制——相对图片路径因此无需重写，唯一需要改的是指向 .md 的链接（换 .html）。
 *
 * 导航两种来源（见 docs/site-export-config-plan.md）：
 * - plain / vuepress 风味：按目录结构自动推导（buildNavModel；数字前缀决定排序并
 *   从显示名剥离；README.md / index.md 成为所在目录的 index.html）
 * - mkdocs 风味：nav 配置原文驱动（buildNavFromMkdocsNav；标题/顺序/分组照抄，
 *   支持外链条目，**不追加**未收录页面——nav 是策展白名单）
 */

/** 导航条目 */
export interface SiteNavEntry {
  type: 'page' | 'dir' | 'external'
  /** 显示名（自动推导：剥离数字前缀，页面优先取首个 H1；mkdocs nav：配置原文标题） */
  title: string
  /** 页面输出相对路径（'/' 分隔，如 guide/intro.html）；dir/external 无 */
  htmlPath?: string
  /** external 条目的目标 URL（新窗口打开） */
  externalUrl?: string
  /** 页面源文件绝对路径；dir/external 无 */
  sourcePath?: string
  children?: SiteNavEntry[]
}

/** 拍平后的站点条目（页面或资产） */
export interface SiteFileEntry {
  /** 源文件绝对路径 */
  sourcePath: string
  /** 相对打开目录的路径（'/' 分隔） */
  relPath: string
}

export interface SiteNav {
  entries: SiteNavEntry[]
  /** 根目录存在 README/index 页时为 'index.html'，否则为 null */
  homeHtmlPath: string | null
  /** 导航序（深度优先）第一个页面的 htmlPath，用于无首页时生成重定向 */
  firstHtmlPath: string | null
}

const MARKDOWN_EXT_RE = /\.(md|markdown)$/i
const INDEX_PAGE_RE = /^(readme|index)\.(md|markdown)$/i
/** 排序前缀：01-intro.md / 01_intro / 01.intro / 01)intro / `01 intro` */
const ORDER_PREFIX_RE = /^(\d+)[-_.)\s]+/

export function isMarkdownFile(name: string): boolean {
  return MARKDOWN_EXT_RE.test(name)
}

/** 剥离数字排序前缀（无前缀原样返回） */
export function stripOrderPrefix(name: string): string {
  return name.replace(ORDER_PREFIX_RE, '')
}

function orderPrefixOf(name: string): number | null {
  const match = name.match(ORDER_PREFIX_RE)
  return match ? Number(match[1]) : null
}

/** 导航排序：README/index 页恒在最前（目录首页），带数字前缀的按数字，无前缀的按名称 */
export function compareNavNames(a: string, b: string): number {
  const aIndex = INDEX_PAGE_RE.test(a)
  const bIndex = INDEX_PAGE_RE.test(b)
  if (aIndex !== bIndex) return aIndex ? -1 : 1
  const na = orderPrefixOf(a)
  const nb = orderPrefixOf(b)
  if (na !== null && nb !== null && na !== nb) return na - nb
  if (na !== null && nb === null) return -1
  if (na === null && nb !== null) return 1
  return a.localeCompare(b)
}

/** .md/.markdown 源相对路径 → 站点 HTML 相对路径；README/index → 所在目录 index.html */
export function mdToHtmlPath(relPath: string): string {
  const idx = relPath.lastIndexOf('/')
  const dir = idx >= 0 ? relPath.slice(0, idx + 1) : ''
  const base = idx >= 0 ? relPath.slice(idx + 1) : relPath
  if (INDEX_PAGE_RE.test(base)) return `${dir}index.html`
  return dir + base.replace(MARKDOWN_EXT_RE, '.html')
}

/** 拍平文件树：.md/.markdown 为页面，其余文件为复制资产（目录递归展开） */
export function collectSiteEntries(tree: FileTreeItem[]): {
  pages: SiteFileEntry[]
  assets: SiteFileEntry[]
} {
  const pages: SiteFileEntry[] = []
  const assets: SiteFileEntry[] = []

  const walk = (items: FileTreeItem[], prefix: string) => {
    for (const item of items) {
      const relPath = prefix ? `${prefix}/${item.name}` : item.name
      if (item.isDirectory) {
        walk(item.children ?? [], relPath)
      } else if (isMarkdownFile(item.name)) {
        pages.push({ sourcePath: item.path, relPath })
      } else {
        assets.push({ sourcePath: item.path, relPath })
      }
    }
  }
  walk(tree, '')
  return { pages, assets }
}

/** 提取页面标题：首个 `# H1`，由调用方注入 buildNavModel 的 titles；跳过文档开头 frontmatter */
export function pageTitleFromMarkdown(content: string): string | null {
  for (const line of content.replace(FRONTMATTER_BLOCK_RE, '').split('\n')) {
    const match = line.match(/^#\s+(.+?)\s*#*\s*$/)
    if (match) return match[1]
    // 遇到非空非 H1 内容即停止（避免误取文档中部标题）
    if (line.trim() !== '' && !line.startsWith('#')) return null
    if (line.startsWith('##')) return null
  }
  return null
}

/** 文件名回退标题：剥离数字前缀与扩展名 */
export function fallbackPageTitle(relPath: string): string {
  const base = relPath.slice(relPath.lastIndexOf('/') + 1)
  return stripOrderPrefix(base.replace(MARKDOWN_EXT_RE, ''))
}

/**
 * 从文件树构建导航模型。
 * @param titles 可选页面标题表（sourcePath → 首个 H1），缺省用文件名回退；
 *   目录内 README/index 页的回退标题用目录名（它代表该目录的首页）
 */
export function buildNavModel(tree: FileTreeItem[], titles?: ReadonlyMap<string, string>): SiteNav {
  let homeHtmlPath: string | null = null
  let firstHtmlPath: string | null = null

  const build = (items: FileTreeItem[], prefix: string): SiteNavEntry[] => {
    const sorted = [...items].sort((a, b) => compareNavNames(a.name, b.name))
    const entries: SiteNavEntry[] = []

    for (const item of sorted) {
      const relPath = prefix ? `${prefix}/${item.name}` : item.name
      if (item.isDirectory) {
        const children = build(item.children ?? [], relPath)
        if (children.length === 0) continue // 空目录（无页面）不进导航
        entries.push({ type: 'dir', title: stripOrderPrefix(item.name), children })
      } else if (isMarkdownFile(item.name)) {
        const htmlPath = mdToHtmlPath(relPath)
        let title = titles?.get(item.path) ?? fallbackPageTitle(relPath)
        // 目录的 README/index 页用目录名做回退标题（根目录除外，由调用方注入标题）
        if (!titles?.has(item.path) && INDEX_PAGE_RE.test(item.name) && prefix) {
          title = stripOrderPrefix(prefix.slice(prefix.lastIndexOf('/') + 1))
        }
        if (htmlPath === 'index.html') homeHtmlPath = htmlPath
        if (firstHtmlPath === null) firstHtmlPath = htmlPath
        entries.push({ type: 'page', title, htmlPath, sourcePath: item.path })
      }
    }
    return entries
  }

  const entries = build(tree, '')
  return { entries, homeHtmlPath, firstHtmlPath }
}

/**
 * mkdocs nav 配置 → 导航模型（mkdocs 风味专用，取代 buildNavModel 的自动推导）。
 *
 * 语义对齐 mkdocs：nav 是策展白名单——标题/顺序/分组照抄原文，支持外链条目；
 * 未收录页面不进导航（但照常导出，见 exportSite 编排）；nav 指向的文件不存在
 * 时跳过该项并记入 missingPaths（mkdocs 构建会报错，我们降级跳过 + 日志）。
 *
 * @returns nav 与 missingPaths（nav 中指向不存在文件的路径列表）
 */
export function buildNavFromMkdocsNav(
  mkdocsNav: MkdocsNavItem[],
  pages: SiteFileEntry[]
): { nav: SiteNav; missingPaths: string[] } {
  const pageByRel = new Map(pages.map((page) => [page.relPath, page]))
  const missingPaths: string[] = []
  let firstHtmlPath: string | null = null

  const build = (items: MkdocsNavItem[]): SiteNavEntry[] => {
    const entries: SiteNavEntry[] = []
    for (const item of items) {
      if (item.children) {
        const children = build(item.children)
        // 组内条目全部缺失时整组不进导航
        if (children.length > 0) entries.push({ type: 'dir', title: item.title, children })
        continue
      }
      if (item.url) {
        entries.push({ type: 'external', title: item.title, externalUrl: item.url })
        continue
      }
      if (item.path) {
        const page = pageByRel.get(item.path)
        if (!page) {
          missingPaths.push(item.path)
          continue
        }
        const htmlPath = mdToHtmlPath(page.relPath)
        if (firstHtmlPath === null) firstHtmlPath = htmlPath
        entries.push({ type: 'page', title: item.title, htmlPath, sourcePath: page.sourcePath })
      }
    }
    return entries
  }

  const entries = build(mkdocsNav)
  // 首页以页面集为准（根 README/index 存在即有 index.html，无论是否在 nav 中）
  const homeHtmlPath = pages.some((page) => mdToHtmlPath(page.relPath) === 'index.html')
    ? 'index.html'
    : null
  // nav 无页面（或全缺失）时退回页面集第一个，保证重定向首页有目标
  if (firstHtmlPath === null && pages.length > 0) {
    firstHtmlPath = mdToHtmlPath(pages[0].relPath)
  }
  return { nav: { entries, homeHtmlPath, firstHtmlPath }, missingPaths }
}

/** GitHub 风格标题 slug：小写、去标点（保留字母/数字/CJK/空格/_/-）、空格转连字符 */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
}

/** 页内 slug 去重器（GitHub 约定：重复标题追加 -1、-2） */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text) => {
    const base = slugifyHeading(text)
    const count = seen.get(base)
    if (count === undefined) {
      seen.set(base, 0)
      return base
    }
    seen.set(base, count + 1)
    return `${base}-${count + 1}`
  }
}

function parseHtmlFragment(html: string): Document {
  return new DOMParser().parseFromString(`<div id="site-root">${html}</div>`, 'text/html')
}

function serializeFragment(doc: Document): string {
  return (doc.getElementById('site-root') as HTMLElement).innerHTML
}

/** 给 h1–h6 加 GitHub 风格 id（已有 id 的保留并计入去重），页内 #anchor 链接因此可用 */
export function addHeadingIds(html: string): string {
  const doc = parseHtmlFragment(html)
  const slugger = createSlugger()
  for (const el of Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
    const existing = el.getAttribute('id')
    if (existing) {
      slugger(existing) // 注册占用，避免后续标题撞同 slug
      continue
    }
    el.setAttribute('id', slugger(el.textContent ?? ''))
  }
  return serializeFragment(doc)
}

/** 是否是外部/特殊链接（scheme、protocol-relative、纯锚点） */
function isExternalHref(href: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) || href.startsWith('//') || href.startsWith('#')
}

/** 相对 .md 链接的 path 部分 → .html（README/index 目标映射为 index.html） */
export function mdHrefToHtml(pathPart: string): string | null {
  if (!MARKDOWN_EXT_RE.test(pathPart)) return null
  const idx = pathPart.lastIndexOf('/')
  const dir = idx >= 0 ? pathPart.slice(0, idx + 1) : ''
  const base = idx >= 0 ? pathPart.slice(idx + 1) : pathPart
  if (INDEX_PAGE_RE.test(base)) return `${dir}index.html`
  return dir + base.replace(MARKDOWN_EXT_RE, '.html')
}

/** 把渲染 HTML 中指向 .md/.markdown 的相对链接重写为对应 .html，保留 #anchor */
export function rewriteMarkdownLinks(html: string): string {
  const doc = parseHtmlFragment(html)
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') ?? ''
    if (isExternalHref(href)) continue
    const hashIdx = href.indexOf('#')
    const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href
    const frag = hashIdx >= 0 ? href.slice(hashIdx) : ''
    const rewritten = mdHrefToHtml(pathPart)
    if (rewritten !== null) a.setAttribute('href', rewritten + frag)
  }
  return serializeFragment(doc)
}

/** 页面相对站点根的前缀（guide/intro.html → '../'），用于引用共享 CSS 与导航链接 */
export function relPrefix(htmlPath: string): string {
  const depth = htmlPath.split('/').length - 1
  return '../'.repeat(depth)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function entryContainsPath(entry: SiteNavEntry, htmlPath: string): boolean {
  if (entry.type === 'page') return entry.htmlPath === htmlPath
  return (entry.children ?? []).some((child) => entryContainsPath(child, htmlPath))
}

/**
 * 渲染侧边导航 HTML：嵌套 <ul>，目录用 <details>/<summary> 零 JS 折叠；
 * 当前页 active + aria-current；顶层目录与含当前页的分支默认展开；
 * external 条目新窗口打开并带外链样式（site.css 的 .external 箭头）。
 */
export function renderNavHtml(entries: SiteNavEntry[], currentHtmlPath: string): string {
  const prefix = relPrefix(currentHtmlPath)

  const renderEntries = (items: SiteNavEntry[], depth: number): string => {
    const lis = items
      .map((entry) => {
        if (entry.type === 'dir') {
          const open = depth === 0 || entryContainsPath(entry, currentHtmlPath) ? ' open' : ''
          return `<li><details${open}><summary>${escapeHtml(entry.title)}</summary><ul>${renderEntries(
            entry.children ?? [],
            depth + 1
          )}</ul></details></li>`
        }
        if (entry.type === 'external') {
          return `<li><a class="external" href="${escapeHtml(
            entry.externalUrl ?? ''
          )}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.title)}</a></li>`
        }
        const active = entry.htmlPath === currentHtmlPath
        const cls = active ? ' class="active"' : ''
        const aria = active ? ' aria-current="page"' : ''
        return `<li><a href="${prefix}${entry.htmlPath}"${cls}${aria}>${escapeHtml(
          entry.title
        )}</a></li>`
      })
      .join('')
    return lis
  }

  return `<ul class="site-nav-list">${renderEntries(entries, 0)}</ul>`
}
