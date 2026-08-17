import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import i18n from '../i18n'
import { useEditorStore } from '../stores/editorStore'
import { alertDialog } from './dialog'
import { collectDocumentCss } from './exportPdf'
import { pathExists, readDirectory } from './fileTreeUtils'
import { isTauri } from './imageSrc'
import { createLogger } from './logger'
import { parseMarkdownAsync } from './markdown/parser'
import {
  compileExcludePatterns,
  detectSiteFlavor,
  frontmatterTitle,
  parseFrontmatter,
  type FlavorIo,
  type SiteFlavor,
} from './siteConfig'
import {
  addHeadingIds,
  buildNavFromMkdocsNav,
  buildNavModel,
  collectPublicAssets,
  collectSiteEntries,
  fallbackPageTitle,
  filterFileTreeByExcludes,
  mdToHtmlPath,
  pageTitleFromMarkdown,
  relPrefix,
  renderNavHtml,
  rewriteMarkdownLinks,
  type SiteNav,
  type SiteNavEntry,
} from './siteGenerator'
import { buildRedirectPage, buildSiteCss, buildSitePage } from './siteTemplate'

const logger = createLogger('ExportSite')

/**
 * 「导出为网站」编排层：把打开的文件夹渲染为可直接部署的静态站点包。
 *
 * 纯逻辑（目录→页面映射、导航、链接重写）在 siteGenerator.ts（可单测）；
 * mkdocs/vuepress 配置感知（风味探测、mkdocs.yml 解析、frontmatter）在 siteConfig.ts；
 * 页面框架在 siteTemplate.ts；写盘走 Rust export_site 命令（原生复制二进制资产，
 * 不需要 plugin-fs 写权限）。方案见 docs/site-export-config-plan.md。
 */

interface FileInfo {
  path: string
  content: string
  name: string
}

interface ExportSiteFilePayload {
  path: string
  content?: string
  sourcePath?: string
}

interface ExportSiteResult {
  success: boolean
  error: string | null
  written: number
}

/** 取路径末段作为站点名（兼容 Windows 反斜杠与尾部分隔符） */
function baseName(path: string): string {
  const normalized = path.replace(/[/\\]+$/, '')
  const idx = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  return idx >= 0 ? normalized.slice(idx + 1) : normalized
}

/** 拍平导航为 htmlPath → 显示标题（供 <title> 使用） */
function flattenNavTitles(entries: SiteNavEntry[], out = new Map<string, string>()) {
  for (const entry of entries) {
    if (entry.type === 'page' && entry.htmlPath) {
      out.set(entry.htmlPath, entry.title)
    } else if (entry.children) {
      flattenNavTitles(entry.children, out)
    }
  }
  return out
}

/** 成功提示按风味选择 i18n key（已决策：提示带一句配置来源，不打断流程、不加确认框） */
function successMessageKey(flavor: SiteFlavor): string {
  if (flavor === 'mkdocs') return 'messages.exportSiteSuccessMkdocs'
  if (flavor === 'vuepress') return 'messages.exportSiteSuccessVuepress'
  return 'messages.exportSiteSuccess'
}

/**
 * 导出当前打开的文件夹为静态站点。
 * 流程：选输出目录 → 读目录树 → 渲染全部页面 → Rust 写盘 → 结果提示。
 *
 * @returns 是否成功（用户取消对话框属正常中断，也返回 false）
 */
export async function exportSite(): Promise<boolean> {
  if (!isTauri()) return false

  const { openedFolder, language } = useEditorStore.getState()
  if (!openedFolder) {
    logger.warn('exportSite called without opened folder')
    return false
  }

  logger.time('exportSite')

  let picked: string | null
  try {
    picked = await open({ directory: true, multiple: false })
  } catch (error) {
    logger.error('Output directory dialog failed:', error)
    return false
  }
  if (!picked || typeof picked !== 'string') {
    logger.debug('Site export cancelled by user')
    return false
  }

  try {
    // 风味探测：mkdocs > vuepress > plain（IO 走现有 Tauri 命令封装）
    const io: FlavorIo = {
      fileExists: pathExists,
      readTextFile: async (path) => (await invoke<FileInfo>('read_file', { path })).content,
    }
    const flavorInfo = await detectSiteFlavor(openedFolder, io)
    if (flavorInfo.warning) logger.warn('Site flavor detection:', flavorInfo.warning)
    if (flavorInfo.flavor !== 'plain') {
      logger.info('Site flavor detected:', {
        flavor: flavorInfo.flavor,
        docsRoot: flavorInfo.docsRoot,
        configPath: flavorInfo.mkdocsConfigPath,
      })
    }

    // 站点名：mkdocs site_name → vuepress config title（正则提取）→ 目录名回退；
    // 导出范围收敛到 docsRoot（'' = 打开目录本身）
    const siteTitle =
      flavorInfo.mkdocsConfig?.siteName ?? flavorInfo.vuepressSiteName ?? baseName(openedFolder)
    const outputDir = `${picked}/${siteTitle}-site`
    const docsRootAbs = flavorInfo.docsRoot
      ? `${openedFolder}/${flavorInfo.docsRoot}`
      : openedFolder

    // 原始树（不做前端的 md-only 过滤——资产也要复制；Rust 侧已跳过隐藏/node_modules/target）
    let tree = await readDirectory(docsRootAbs, true)

    // mkdocs exclude_docs（1.5+，.gitignore 模式相对 docs_dir）：页面与资产同滤，
    // 这是唯一会删减导出内容的配置（nav 只是导航白名单，见方案决策 3）
    const excludePatterns = compileExcludePatterns(flavorInfo.mkdocsConfig?.excludeDocs ?? [])
    if (excludePatterns.length > 0) {
      tree = filterFileTreeByExcludes(tree, excludePatterns)
      logger.info('exclude_docs applied:', flavorInfo.mkdocsConfig?.excludeDocs)
    }

    const { pages, assets } = collectSiteEntries(tree)

    // vuepress：`.vuepress/public/*` 原样镜像到站点根（Rust read_directory 的隐藏目录
    // 跳过只作用于列出的子项，直接读 public 目录本身可行——方案 P3 检查点）。
    // 撞名规则：public 覆盖同相对路径的普通资产；与页面 htmlPath 撞名的丢弃（页面优先）
    let allAssets = assets
    if (flavorInfo.flavor === 'vuepress') {
      const publicDirAbs = `${docsRootAbs}/.vuepress/public`
      if (await pathExists(publicDirAbs)) {
        const publicAssets = collectPublicAssets(await readDirectory(publicDirAbs, true))
        const pageHtmlPaths = new Set(pages.map((page) => mdToHtmlPath(page.relPath)))
        const keptPublic = publicAssets.filter((asset) => !pageHtmlPaths.has(asset.relPath))
        if (keptPublic.length !== publicAssets.length) {
          logger.warn('vuepress public 中与页面同名的资产已丢弃（页面优先）')
        }
        const publicRelPaths = new Set(keptPublic.map((asset) => asset.relPath))
        const overridden = allAssets.filter((asset) => publicRelPaths.has(asset.relPath))
        if (overridden.length > 0) {
          logger.warn(
            'vuepress public 覆盖同名资产:',
            overridden.map((asset) => asset.relPath)
          )
        }
        allAssets = [
          ...allAssets.filter((asset) => !publicRelPaths.has(asset.relPath)),
          ...keptPublic,
        ]
        logger.info('vuepress public assets merged:', keptPublic.length)
      }
    }

    if (pages.length === 0) {
      logger.timeEnd('exportSite')
      await alertDialog(i18n.t('messages.exportSiteNoPages'))
      return false
    }

    // 并行读入全部页面源码：剥离 frontmatter（不渲染）；标题链 frontmatter title → 首个 H1
    const contents = new Map<string, string>()
    const titles = new Map<string, string>()
    await Promise.all(
      pages.map(async (page) => {
        const info = await invoke<FileInfo>('read_file', { path: page.sourcePath })
        const { data, body } = parseFrontmatter(info.content)
        contents.set(page.sourcePath, body)
        const title = frontmatterTitle(data) ?? pageTitleFromMarkdown(body)
        if (title) titles.set(page.sourcePath, title)
      })
    )

    // 根 README/index 无标题时注入「首页/Home」作为导航与标题回退
    const rootIndexPage = pages.find((p) => mdToHtmlPath(p.relPath) === 'index.html')
    if (rootIndexPage && !titles.has(rootIndexPage.sourcePath)) {
      titles.set(rootIndexPage.sourcePath, i18n.t('site.home'))
    }

    // 导航：mkdocs 风味按 nav 配置原文（策展白名单，不追加）；其余按目录结构自动推导
    let nav: SiteNav
    if (flavorInfo.flavor === 'mkdocs' && flavorInfo.mkdocsConfig?.nav?.length) {
      const built = buildNavFromMkdocsNav(flavorInfo.mkdocsConfig.nav, pages)
      nav = built.nav
      if (built.missingPaths.length > 0) {
        logger.warn('mkdocs nav 指向的文件不存在，已跳过:', built.missingPaths)
      }
    } else {
      nav = buildNavModel(tree, titles)
    }
    const titleByPath = flattenNavTitles(nav.entries)

    // 渲染页面：保留相对图片路径（资产镜像复制），加标题 id，重写 .md 互链；
    // PlantUML 经本地引擎内联 SVG（部署后无需联网）
    const renderedPages = await Promise.all(
      pages.map(async (page) => {
        const htmlPath = mdToHtmlPath(page.relPath)
        let body = await parseMarkdownAsync(contents.get(page.sourcePath) ?? '', {
          preserveImages: true,
          inlinePlantUml: true,
        })
        body = rewriteMarkdownLinks(addHeadingIds(body))
        return { htmlPath, body, page }
      })
    )
    const hasKatex = renderedPages.some((p) => p.body.includes('class="katex"'))

    const siteCss = await buildSiteCss(collectDocumentCss(), hasKatex)

    const files: ExportSiteFilePayload[] = [
      { path: 'vividmark-site/site.css', content: siteCss },
      // GitHub Pages 兼容：关闭 Jekyll 处理
      { path: '.nojekyll', content: '' },
    ]
    for (const rendered of renderedPages) {
      files.push({
        path: rendered.htmlPath,
        content: buildSitePage({
          // 页面 <title> 解析链：nav 标题 → frontmatter/H1 → 文件名回退
          title:
            titleByPath.get(rendered.htmlPath) ??
            titles.get(rendered.page.sourcePath) ??
            fallbackPageTitle(rendered.page.relPath),
          siteTitle,
          themeToggleLabel: i18n.t('site.toggleTheme'),
          navHtml: renderNavHtml(nav.entries, rendered.htmlPath),
          bodyHtml: rendered.body,
          relPrefix: relPrefix(rendered.htmlPath),
          lang: language,
        }),
      })
    }
    // 根目录无 README/index 时生成重定向首页（指向导航第一页）
    if (!nav.homeHtmlPath && nav.firstHtmlPath) {
      files.push({
        path: 'index.html',
        content: buildRedirectPage(nav.firstHtmlPath, siteTitle, language),
      })
    }
    for (const asset of allAssets) {
      files.push({ path: asset.relPath, sourcePath: asset.sourcePath })
    }

    const result = await invoke<ExportSiteResult>('export_site', {
      params: { outputDir, files },
    })

    if (!result.success) {
      throw new Error(result.error ?? 'unknown error')
    }

    logger.timeEnd('exportSite')
    logger.info('Site exported:', {
      outputDir,
      flavor: flavorInfo.flavor,
      pages: renderedPages.length,
      written: result.written,
    })
    await alertDialog(i18n.t(successMessageKey(flavorInfo.flavor), { path: outputDir }))
    return true
  } catch (error) {
    logger.timeEnd('exportSite')
    logger.error('Site export failed:', error)
    await alertDialog(i18n.t('messages.exportSiteFailed'))
    return false
  }
}
