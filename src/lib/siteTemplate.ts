import { inlineKatexFonts } from './exportPdf'

/**
 * 导出站点的页面框架：mkdocs 风格布局（顶部栏 + 左侧导航 + 内容区）+ 浅/深色切换。
 *
 * 样式策略：共享 CSS 文件 = collectDocumentCss()（应用同款 .markdown-body/hljs/主题变量，
 * 必要时内联 KaTeX 字体）+ SITE_CSS（框架布局，复用应用主题变量，排在最后故优先级最高）。
 * 深色模式 = <html> 加 .dark class，与应用同一套变量约定。
 */

/** 站点框架布局样式（追加在收集的应用 CSS 之后） */
const SITE_CSS = `
/* ===== VividMark 导出站点框架 ===== */
html, body {
  margin: 0;
  padding: 0;
  background: var(--editor-bg);
  color: var(--editor-text);
}
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  background: var(--toolbar-bg);
  border-bottom: 1px solid var(--editor-border);
  box-sizing: border-box;
}
.site-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--editor-text);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-theme-toggle {
  display: flex;
  align-items: center;
  padding: 6px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}
.site-theme-toggle:hover { background: var(--hover-bg); }
.site-theme-toggle .icon-moon { display: none; }
.dark .site-theme-toggle .icon-sun { display: none; }
.dark .site-theme-toggle .icon-moon { display: block; }
.site-layout {
  display: flex;
  align-items: flex-start;
}
.site-nav {
  position: sticky;
  top: 56px;
  width: 280px;
  flex-shrink: 0;
  height: calc(100vh - 56px);
  overflow-y: auto;
  padding: 16px 12px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--editor-border);
  box-sizing: border-box;
}
.site-nav-list, .site-nav-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.site-nav-list ul { padding-left: 14px; }
.site-nav-list a {
  display: block;
  padding: 5px 10px;
  margin: 1px 0;
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text-secondary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-nav-list a:hover { background: var(--hover-bg); color: var(--editor-text); }
.site-nav-list a.active {
  color: var(--accent-color);
  background: var(--hover-bg);
  font-weight: 500;
}
.site-nav-list summary {
  padding: 5px 10px;
  margin: 1px 0;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--editor-text);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-nav-list summary:hover { background: var(--hover-bg); }
.site-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 64px;
}
/* 锚点跳转避开 sticky 顶栏 */
.markdown-body h1[id], .markdown-body h2[id], .markdown-body h3[id],
.markdown-body h4[id], .markdown-body h5[id], .markdown-body h6[id] {
  scroll-margin-top: 72px;
}
@media (max-width: 860px) {
  .site-layout { flex-direction: column; }
  .site-nav {
    position: static;
    width: auto;
    height: auto;
    max-height: none;
    border-right: none;
    border-bottom: 1px solid var(--editor-border);
  }
}
`

/** 站点共享 CSS：应用收集样式（含公式时内联 KaTeX 字体）+ 框架样式 */
export async function buildSiteCss(appCss: string, hasKatex: boolean): Promise<string> {
  const css = hasKatex ? await inlineKatexFonts(appCss) : appCss
  return `${css}\n${SITE_CSS}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 防闪烁主题初始化：localStorage 优先，否则跟随系统（与站点切换按钮同一存储键） */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('vividmark-site-theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

const THEME_TOGGLE_SCRIPT = `(function(){var b=document.getElementById('site-theme-toggle');if(!b)return;b.addEventListener('click',function(){var d=document.documentElement.classList.toggle('dark');try{localStorage.setItem('vividmark-site-theme',d?'dark':'light')}catch(e){}})})()`

const SUN_ICON = `<svg class="icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`

const MOON_ICON = `<svg class="icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`

export interface SitePageParams {
  /** 页面标题（<title> 与内容无关部分） */
  title: string
  /** 站点名（顶栏，一般是打开的文件夹名） */
  siteTitle: string
  /** 主题切换按钮的 aria-label/title（跟随导出时应用语言） */
  themeToggleLabel: string
  /** renderNavHtml 产出的导航 HTML */
  navHtml: string
  /** 渲染好的 markdown-body 内容 HTML */
  bodyHtml: string
  /** 相对站点根的前缀（relPrefix(htmlPath)），引用共享 CSS 与首页 */
  relPrefix: string
  /** <html lang> */
  lang: string
}

/** 生成一个完整的站点页面 */
export function buildSitePage(params: SitePageParams): string {
  const { title, siteTitle, themeToggleLabel, navHtml, bodyHtml, relPrefix, lang } = params
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} · ${escapeHtml(siteTitle)}</title>
<script>${THEME_INIT_SCRIPT}</script>
<link rel="stylesheet" href="${relPrefix}vividmark-site/site.css">
</head>
<body>
<header class="site-header">
<a class="site-title" href="${relPrefix}index.html">${escapeHtml(siteTitle)}</a>
<button id="site-theme-toggle" class="site-theme-toggle" title="${escapeHtml(
    themeToggleLabel
  )}" aria-label="${escapeHtml(themeToggleLabel)}">${SUN_ICON}${MOON_ICON}</button>
</header>
<div class="site-layout">
<nav class="site-nav">${navHtml}</nav>
<main class="site-content">
<div class="markdown-body">${bodyHtml}</div>
</main>
</div>
<script>${THEME_TOGGLE_SCRIPT}</script>
</body>
</html>`
}

/** 无根 README/index 时生成的重定向首页（指向导航第一页） */
export function buildRedirectPage(targetHtmlPath: string, siteTitle: string, lang: string): string {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=${escapeHtml(targetHtmlPath)}">
<link rel="canonical" href="${escapeHtml(targetHtmlPath)}">
<title>${escapeHtml(siteTitle)}</title>
</head>
<body>
<p><a href="${escapeHtml(targetHtmlPath)}">${escapeHtml(siteTitle)}</a></p>
</body>
</html>`
}
