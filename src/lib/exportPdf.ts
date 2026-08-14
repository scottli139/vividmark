import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

import i18n from '../i18n'
import { useEditorStore } from '../stores/editorStore'
import { alertDialog } from './dialog'
import { isTauri } from './imageSrc'
import { fileOpsLogger } from './logger'
import { parseMarkdownAsync } from './markdown/parser'

interface ExportPdfResult {
  success: boolean
  error: string | null
}

/**
 * 回退路径：WebView 原生打印对话框（用户手动选择「存储为 PDF」）。
 *
 * 用于不支持直存的平台（Linux / 旧 macOS / 旧 WebView2 Runtime）。
 * Rust 侧在当前 WebView 注入打印样式后调用 window.print()。
 */
export async function printToPdf(): Promise<boolean> {
  fileOpsLogger.time('printPdf')
  fileOpsLogger.info('Opening native print dialog')

  try {
    // 获取当前文件名
    const { fileName } = useEditorStore.getState()
    const baseFileName = fileName.replace(/\.[^/.]+$/, '') || 'document'

    const result = await invoke<ExportPdfResult>('print_pdf', {
      fileName: baseFileName,
    })

    if (result.success) {
      fileOpsLogger.timeEnd('printPdf')
      fileOpsLogger.info('Print dialog opened successfully')
      return true
    }

    fileOpsLogger.error('Failed to open print dialog:', result.error)
    return false
  } catch (error) {
    fileOpsLogger.error('Print PDF error:', error)
    return false
  }
}

let pdfExportSupportedCache: boolean | null = null

/** 平台是否支持 PDF 直存（macOS 11+ / Windows WebView2；Linux 不支持）。结果缓存。 */
async function isPdfExportSupported(): Promise<boolean> {
  if (pdfExportSupportedCache === null) {
    try {
      pdfExportSupportedCache = await invoke<boolean>('pdf_export_supported')
    } catch (error) {
      fileOpsLogger.error('Failed to check PDF export support:', error)
      pdfExportSupportedCache = false
    }
  }
  return pdfExportSupportedCache
}

/** 与 Editor.tsx 预览一致的 baseDir 计算（处理 Windows 反斜杠路径） */
function getBaseDir(filePath: string | null): string | undefined {
  if (!filePath) return undefined
  const lastSlash = filePath.lastIndexOf('/')
  const lastBackslash = filePath.lastIndexOf('\\')
  const separatorIndex = Math.max(lastSlash, lastBackslash)
  return separatorIndex > 0 ? filePath.substring(0, separatorIndex) : undefined
}

/** 序列化当前文档的全部样式表（含 Tailwind/hljs/.markdown-body），保证 PDF 与预览一致 */
export function collectDocumentCss(): string {
  const chunks: string[] = []
  const sheets: CSSStyleSheet[] = [
    ...Array.from(document.styleSheets),
    ...Array.from(document.adoptedStyleSheets ?? []),
  ]
  for (const sheet of sheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        chunks.push(rule.cssText)
      }
    } catch {
      // 跨域样式表不可读，跳过
    }
  }
  return chunks.join('\n')
}

/**
 * 把 CSS 中的 KaTeX woff2 字体 URL 内联为 base64 data URL。
 *
 * KaTeX 的 @font-face 引用应用构建产物里的字体文件（tauri:// / http:// origin），
 * PDF 隐藏窗口走 vividmark-pdf:// 自定义协议，跨协议请求是死链——无字体会导致
 * 分数/积分号等字形错乱。在主窗口 origin 下 fetch 字体转 data URL 后替换。
 * 单个字体加载失败保留原 URL（回退系统字体），不阻断导出。
 */
export async function inlineKatexFonts(css: string): Promise<string> {
  const urls = new Set<string>()
  for (const match of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
    if (match[2].includes('.woff2')) urls.add(match[2])
  }

  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const blob = await (await fetch(url)).blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
        css = css.split(url).join(dataUrl)
      } catch (error) {
        fileOpsLogger.warn(`Failed to inline KaTeX font: ${url}`, error)
      }
    })
  )
  return css
}

/**
 * 导出专用样式。页面边距主要由 Rust 侧打印参数（15mm）决定；
 * 导出 HTML 不带 .dark class，PDF 恒为浅色主题。
 */
const PDF_EXPORT_CSS = `
@page { margin: 15mm; }
html, body, #root { height: auto !important; overflow: visible !important; }
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
/* 打印密度调整（预览为 16px 字号 / 24px padding / 10px 14px 单元格），不改预览 */
.markdown-body {
  max-width: none !important;
  padding: 0 !important;
  font-size: 14px;
}
/* 末元素 margin 在内容恰好满页时会溢出产生尾部空白页 */
.markdown-body > :last-child { margin-bottom: 0 !important; }
.markdown-body img { max-width: 100%; height: auto; }
/* WebKit 打印在页面可打印区边界裁掉表格外凸的半宽边框（collapse 网格右/下外边线超出
   表格盒模型外半侧），100% 宽表格的右边线因此缺失；收窄 2px 让外凸半侧留在可打印区内 */
.markdown-body table { width: calc(100% - 2px) !important; }
/* 长代码行打印必须折行：应用侧 .hljs code 有 white-space: pre !important，需同优先级+靠后覆盖 */
.markdown-body pre, .markdown-body pre code,
.markdown-body pre.hljs code, .markdown-body code.hljs {
  white-space: pre-wrap !important;
  word-wrap: break-word !important;
  word-break: break-all !important;
}
/* 单元格内图片的 max-width:100% 在 WebKit 按 padding box 解析，会被表格 overflow:hidden 切掉右侧；
   含图单元格去掉左右 padding 后内容盒 = 填充盒，图片完整 */
.markdown-body td:has(> img), .markdown-body th:has(> img) {
  padding-left: 0;
  padding-right: 0;
}
.markdown-body th, .markdown-body td { padding: 6px 10px; }
.markdown-body th { white-space: nowrap; }
/* 首列多为日期/标签类短内容，禁止换行避免被内容列挤压（如「8/1（六）」折行） */
.markdown-body td:first-child, .markdown-body th:first-child { white-space: nowrap; }
.markdown-body pre, .markdown-body blockquote, .markdown-body img {
  page-break-inside: avoid;
}
/* display 公式不跨页（KaTeX 内部是多层绝对定位 span，截断后不可读） */
.markdown-body .katex-display {
  page-break-inside: avoid;
}
/* 长表格允许跨页（整表 avoid 会被整体推到新页，留下大片空白）；
   行级 avoid 在 Chromium(WebView2) 生效，WebKit 对多行文本行仍可能行内断裂（引擎限制）；
   表头在后续页自动重复 */
.markdown-body tr, .markdown-body td, .markdown-body th {
  break-inside: avoid;
  page-break-inside: avoid;
}
.markdown-body thead { display: table-header-group; }
.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  page-break-inside: avoid;
  page-break-after: avoid;
}
`

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

interface PdfOutlineItem {
  text: string
  level: number
}

/** 从渲染后的 HTML 提取标题大纲（textContent 与 PDF 文本一致，供 Rust 侧 PDFKit 检索建书签） */
function extractPdfOutline(bodyHtml: string): PdfOutlineItem[] {
  const doc = new DOMParser().parseFromString(bodyHtml, 'text/html')
  return Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map((el) => ({
      text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      level: Number(el.tagName[1]),
    }))
    .filter((item) => item.text.length > 0)
}

/** 生成独立的导出 HTML 文档（应用同款 CSS + 渲染管线，无应用外壳） */
async function buildPdfExportHtml(bodyHtml: string, title: string): Promise<string> {
  let appCss = collectDocumentCss()
  // 含公式时才内联 KaTeX 字体（无公式零开销）
  if (bodyHtml.includes('class="katex"')) {
    appCss = await inlineKatexFonts(appCss)
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
${appCss}
</style>
<style>
${PDF_EXPORT_CSS}
</style>
</head>
<body>
<div class="markdown-body">${bodyHtml}</div>
</body>
</html>`
}

/**
 * 导出当前文档为 PDF（Typora 式：保存对话框 → 静默生成 PDF 文件）。
 *
 * 流程：平台支持性检查 → 保存对话框（默认 <文件名>.pdf）→ 渲染同款 HTML →
 * Rust 隐藏窗口 print-to-PDF。不支持 / 失败时回退打印对话框。
 *
 * @returns 是否成功（用户取消保存对话框也算 false，但属正常中断）
 */
export async function exportCurrentDocument(): Promise<boolean> {
  // 浏览器 dev / E2E 环境无 Tauri 后端，退化为浏览器打印
  if (!isTauri()) {
    window.print()
    return true
  }

  if (!(await isPdfExportSupported())) {
    fileOpsLogger.info('Direct PDF export unsupported, falling back to print dialog')
    return printToPdf()
  }

  fileOpsLogger.time('exportPdf')

  const { fileName, filePath, content } = useEditorStore.getState()
  const baseFileName = fileName.replace(/\.[^/.]+$/, '') || 'document'

  let outputPath: string | null
  try {
    outputPath = await save({
      defaultPath: `${baseFileName}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
  } catch (error) {
    fileOpsLogger.error('Save dialog failed:', error)
    return false
  }
  if (!outputPath) {
    fileOpsLogger.debug('PDF export cancelled by user')
    return false
  }

  try {
    const bodyHtml = await parseMarkdownAsync(content, {
      baseDir: getBaseDir(filePath),
      // PlantUML 本地渲染内联 SVG：PDF 隐藏窗口零网络依赖
      inlinePlantUml: true,
    })
    const outline = extractPdfOutline(bodyHtml)
    const html = await buildPdfExportHtml(bodyHtml, baseFileName)
    const result = await invoke<ExportPdfResult>('export_pdf_file', {
      params: { html, outputPath, title: baseFileName, outline },
    })

    if (result.success) {
      fileOpsLogger.timeEnd('exportPdf')
      fileOpsLogger.info('PDF exported:', outputPath)
      return true
    }

    // 运行时才判定不支持（如过旧 WebView2 Runtime）→ 回退打印对话框
    if (result.error?.startsWith('unsupported')) {
      fileOpsLogger.warn('Direct PDF export unsupported at runtime, falling back:', result.error)
      return printToPdf()
    }
    throw new Error(result.error ?? 'unknown error')
  } catch (error) {
    fileOpsLogger.timeEnd('exportPdf')
    fileOpsLogger.error('PDF export failed:', error)
    await alertDialog(i18n.t('messages.exportPdfFailed'))
    return false
  }
}
