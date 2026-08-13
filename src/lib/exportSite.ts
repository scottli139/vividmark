import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import i18n from '../i18n'
import { useEditorStore } from '../stores/editorStore'
import { alertDialog } from './dialog'
import { collectDocumentCss } from './exportPdf'
import { readDirectory } from './fileTreeUtils'
import { isTauri } from './imageSrc'
import { createLogger } from './logger'
import { parseMarkdown } from './markdown/parser'
import {
  addHeadingIds,
  buildNavModel,
  collectSiteEntries,
  mdToHtmlPath,
  pageTitleFromMarkdown,
  relPrefix,
  renderNavHtml,
  rewriteMarkdownLinks,
  type SiteNavEntry,
} from './siteGenerator'
import { buildRedirectPage, buildSiteCss, buildSitePage } from './siteTemplate'

const logger = createLogger('ExportSite')

/**
 * 「导出为网站」编排层：把打开的文件夹渲染为可直接部署的静态站点包。
 *
 * 纯逻辑（目录→页面映射、导航、链接重写）在 siteGenerator.ts（可单测）；
 * 页面框架在 siteTemplate.ts；写盘走 Rust export_site 命令（原生复制二进制资产，
 * 不需要 plugin-fs 写权限）。
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

  const siteTitle = baseName(openedFolder)
  const outputDir = `${picked}/${siteTitle}-site`

  try {
    // 原始树（不做前端的 md-only 过滤——资产也要复制；Rust 侧已跳过隐藏/node_modules/target）
    const tree = await readDirectory(openedFolder, true)
    const { pages, assets } = collectSiteEntries(tree)
    if (pages.length === 0) {
      logger.timeEnd('exportSite')
      await alertDialog(i18n.t('messages.exportSiteNoPages'))
      return false
    }

    // 并行读入全部页面源码并提取 H1 标题
    const contents = new Map<string, string>()
    const titles = new Map<string, string>()
    await Promise.all(
      pages.map(async (page) => {
        const info = await invoke<FileInfo>('read_file', { path: page.sourcePath })
        contents.set(page.sourcePath, info.content)
        const h1 = pageTitleFromMarkdown(info.content)
        if (h1) titles.set(page.sourcePath, h1)
      })
    )

    // 根 README/index 无 H1 时注入「首页/Home」作为导航与标题回退
    const rootIndexPage = pages.find((p) => mdToHtmlPath(p.relPath) === 'index.html')
    if (rootIndexPage && !titles.has(rootIndexPage.sourcePath)) {
      titles.set(rootIndexPage.sourcePath, i18n.t('site.home'))
    }

    const nav = buildNavModel(tree, titles)
    const titleByPath = flattenNavTitles(nav.entries)

    // 渲染页面：保留相对图片路径（资产镜像复制），加标题 id，重写 .md 互链
    const renderedPages = pages.map((page) => {
      const htmlPath = mdToHtmlPath(page.relPath)
      let body = parseMarkdown(contents.get(page.sourcePath) ?? '', { preserveImages: true })
      body = rewriteMarkdownLinks(addHeadingIds(body))
      return { htmlPath, body }
    })
    const hasKatex = renderedPages.some((p) => p.body.includes('class="katex"'))

    const siteCss = await buildSiteCss(collectDocumentCss(), hasKatex)

    const files: ExportSiteFilePayload[] = [
      { path: 'vividmark-site/site.css', content: siteCss },
      // GitHub Pages 兼容：关闭 Jekyll 处理
      { path: '.nojekyll', content: '' },
    ]
    for (const page of renderedPages) {
      files.push({
        path: page.htmlPath,
        content: buildSitePage({
          title: titleByPath.get(page.htmlPath) ?? page.htmlPath,
          siteTitle,
          themeToggleLabel: i18n.t('site.toggleTheme'),
          navHtml: renderNavHtml(nav.entries, page.htmlPath),
          bodyHtml: page.body,
          relPrefix: relPrefix(page.htmlPath),
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
    for (const asset of assets) {
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
      pages: renderedPages.length,
      written: result.written,
    })
    await alertDialog(i18n.t('messages.exportSiteSuccess', { path: outputDir }))
    return true
  } catch (error) {
    logger.timeEnd('exportSite')
    logger.error('Site export failed:', error)
    await alertDialog(i18n.t('messages.exportSiteFailed'))
    return false
  }
}
