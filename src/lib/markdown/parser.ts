import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import hljs from 'highlight.js'
import { readFile } from '@tauri-apps/plugin-fs'
import { convertFileSrc } from '@tauri-apps/api/core'
import { isLocalPath, isUrl } from '../imageUtils'
import { admonitionTypes, getAdmonitionDisplayTitle } from './admonitionTypes'
import { bangAdmonitionPlugin } from './bangAdmonitionPlugin'
import { parseFrontmatter } from './frontmatter'
import { getPlantUmlSvgUrl, renderPlantUmlSvg } from '../plantuml'
import { isTauri, resolveToAbsoluteImagePath } from '../imageSrc'
import { mathPlugin } from './mathPlugin'

// 自定义图片渲染规则 - 处理本地文件路径
function convertImageSrc(src: string): string {
  // 如果是 URL 或 data URL，直接返回
  if (isUrl(src)) {
    return src
  }

  // 如果是本地路径且在 Tauri 环境中，使用 convertFileSrc 转换
  if (isLocalPath(src) && isTauri()) {
    try {
      const converted = convertFileSrc(src)
      console.log('[convertImageSrc] Converted:', src, '->', converted)
      return converted
    } catch (error) {
      console.error('[convertImageSrc] Conversion failed:', error)
      return src
    }
  }

  return src
}

// 创建 markdown-it 实例，集成代码高亮
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
  highlight: function (str: string, lang: string): string {
    // 处理 PlantUML
    if (lang === 'plantuml') {
      return renderPlantUML(str)
    }

    // 如果指定了语言且支持，使用该语言高亮
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`
      } catch {
        // 忽略错误，使用自动检测
      }
    }
    // 自动检测语言
    try {
      return `<pre class="hljs"><code>${hljs.highlightAuto(str).value}</code></pre>`
    } catch {
      // 如果高亮失败，返回转义后的原始代码
      return `<pre class="hljs"><code>${MarkdownIt.prototype.utils.escapeHtml(str)}</code></pre>`
    }
  },
})

// 渲染 PlantUML 占位符（本地引擎异步渲染，见 renderPlantUmlPlaceholders）
// highlight 回调必须同步返回，故只产出占位结构，源码经 encodeURIComponent 放入 data 属性
function renderPlantUML(content: string): string {
  return createPlantUmlPlaceholder(content)
}

/**
 * PlantUML 占位符 HTML。markdown-it 同步渲染只产占位，真正的 SVG 渲染有两条路径：
 * - 预览：renderPlantUmlPlaceholders 对挂载后的 DOM 渐进渲染
 * - 导出：parseMarkdownAsync 的 inlinePlantUml 选项对 HTML 字符串替换
 */
function createPlantUmlPlaceholder(source: string): string {
  return `<div class="plantuml-diagram" data-plantuml-src="${encodeURIComponent(source)}"><div class="plantuml-loading"></div></div>`
}

/** 本地渲染失败时的在线服务回退 HTML（保持旧版展示路径） */
function createPlantUmlOnlineFallback(source: string): string {
  try {
    const url = getPlantUmlSvgUrl(source)
    return `<img src="${url}" alt="PlantUML Diagram" loading="lazy" />`
  } catch {
    return `<pre class="hljs plantuml-error"><code>${MarkdownIt.prototype.utils.escapeHtml(source)}</code></pre>`
  }
}

/**
 * 把容器内的 PlantUML 占位符渲染为内联 SVG（本地引擎，离线）。
 * 渲染后保留 data-plantuml-src 属性，主题切换可用不同 dark 参数重跑本函数。
 * 单个图失败时回退在线服务，不影响其他图。
 */
export async function renderPlantUmlPlaceholders(
  root: ParentNode,
  options?: { dark?: boolean }
): Promise<void> {
  const placeholders = root.querySelectorAll<HTMLElement>('[data-plantuml-src]')
  await Promise.all(
    Array.from(placeholders).map(async (el) => {
      const source = decodeURIComponent(el.dataset.plantumlSrc ?? '')
      if (!source.trim()) return
      try {
        el.innerHTML = await renderPlantUmlSvg(source, { dark: options?.dark === true })
      } catch {
        el.innerHTML = createPlantUmlOnlineFallback(source)
      }
    })
  )
}

// 占位符是 createPlantUmlPlaceholder 生成的确定性格式，字符串替换安全
const PLANTUML_PLACEHOLDER_REGEX =
  /<div class="plantuml-diagram" data-plantuml-src="([^"]*)"><div class="plantuml-loading"><\/div><\/div>/g

/** 导出路径：把 HTML 字符串中的占位符替换为内联 SVG（失败回退在线 img） */
async function inlinePlantUmlDiagrams(html: string): Promise<string> {
  const matches = [...html.matchAll(PLANTUML_PLACEHOLDER_REGEX)]
  for (const match of matches) {
    const source = decodeURIComponent(match[1])
    let replacement: string
    try {
      replacement = `<div class="plantuml-diagram">${await renderPlantUmlSvg(source)}</div>`
    } catch {
      replacement = `<div class="plantuml-diagram">${createPlantUmlOnlineFallback(source)}</div>`
    }
    html = html.replace(match[0], replacement)
  }
  return html
}

// 配置 Admonition 容器
admonitionTypes.forEach((type) => {
  md.use(container, type, {
    render: function (tokens: { info: string; nesting: number }[], idx: number) {
      const token = tokens[idx]
      const info = token.info.trim().slice(type.length).trim()

      if (token.nesting === 1) {
        // 打开标签
        const title = getAdmonitionDisplayTitle(type, info)
        return `<div class="admonition ${type}">
  <div class="admonition-title">${title}</div>
  <div class="admonition-content">`
      } else {
        // 关闭标签
        return '</div></div>\n'
      }
    },
  })
})

// KaTeX 数学公式（$...$ 行内 / $$ 多行围栏块级）
md.use(mathPlugin)

// MkDocs `!!!` admonition（自写块级 rule，缩进定界；产出复用现有 admonition HTML/CSS）
md.use(bangAdmonitionPlugin)

// 自定义图片渲染规则
const defaultImageRender =
  md.renderer.rules.image ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')

  // env.preserveImages（站点导出）：保留相对路径 src，资产随站点镜像复制，不做 asset:// 转换
  if (srcIndex >= 0 && !(env as { preserveImages?: boolean } | undefined)?.preserveImages) {
    const src = token.attrs![srcIndex][1]
    token.attrs![srcIndex][1] = convertImageSrc(src)
  }

  return defaultImageRender(tokens, idx, options, env, self)
}

// ==================== 任务列表 (Task Lists) 支持 ====================
// GitHub Flavored Markdown 任务列表语法: - [ ] 和 - [x]

// 任务列表正则表达式 - 匹配行首的任务列表语法
const TASK_LIST_REGEX = /^(\s*)([-*])\s+\[([\sxX])\]\s+(.*)$/

// 全局任务索引计数器，用于给每个 checkbox 唯一标识
let globalTaskIndex = 0

// 重置任务索引（在每次渲染前调用）
function resetTaskIndex(): void {
  globalTaskIndex = 0
}

// 在渲染前预处理任务列表 - 将任务列表语法转换为特殊标记
// 关键：只替换开头的任务标记部分，保留后面的 Markdown 内容不变
// 这样后面的内容可以被正常解析为 Markdown
function preprocessTaskLists(content: string): string {
  const lines = content.split('\n')

  return lines
    .map((line) => {
      const match = line.match(TASK_LIST_REGEX)
      if (match) {
        const indent = match[1]
        const marker = match[2]
        const isChecked = match[3].toLowerCase() === 'x'
        const text = match[4]

        // 使用特殊标记替换 [ ] 或 [x]，保留后面的文本内容不变
        // 格式: [[TASK:index:status]] - 这样易于在后处理中识别
        const status = isChecked ? 'checked' : 'unchecked'
        const taskIdx = globalTaskIndex++
        return `${indent}${marker} [[TASK:${taskIdx}:${status}]] ${text}`
      }
      return line
    })
    .join('\n')
}

/**
 * 后处理任务列表 HTML
 * 将特殊标记替换为 checkbox 元素
 */
function postprocessTaskLists(html: string): string {
  // 首先处理嵌套在 <p> 中的情况（markdown-it 有时会这样做）
  // 格式: <li>\n<p>[[TASK:0:checked]] 任务文本</p>\n</li>
  html = html.replace(
    /<li([^>]*)>\s*<p>\[\[TASK:(\d+):(\w+)\]\]\s*([\s\S]*?)<\/p>\s*<\/li>/g,
    (_match, attrs, taskIndex, status, content) => {
      return createTaskListItemHtml(attrs, taskIndex, status, content)
    }
  )

  // 处理普通情况
  // 格式: <li>\n[[TASK:0:checked]] 任务文本\n</li>
  html = html.replace(
    /<li([^>]*)>\s*\[\[TASK:(\d+):(\w+)\]\]\s*([\s\S]*?)<\/li>/g,
    (_match, attrs, taskIndex, status, content) => {
      return createTaskListItemHtml(attrs, taskIndex, status, content)
    }
  )

  return html
}

/**
 * 创建任务列表项 HTML
 */
function createTaskListItemHtml(
  attrs: string,
  taskIndex: string,
  status: string,
  content: string
): string {
  const isChecked = status === 'checked'
  const checkboxId = `task-checkbox-${taskIndex}`

  // 添加任务列表类名
  const trimmedAttrs = attrs.trim()
  const classMatch = trimmedAttrs.match(/class="([^"]*)"/)
  let newAttrs: string

  if (classMatch) {
    // 已有 class 属性，追加
    const existingClass = classMatch[1]
    newAttrs = trimmedAttrs.replace(/class="([^"]*)"/, `class="${existingClass} task-list-item"`)
  } else if (trimmedAttrs) {
    // 有其他属性但没有 class，添加 class
    newAttrs = `${trimmedAttrs} class="task-list-item"`
  } else {
    // 没有任何属性
    newAttrs = ' class="task-list-item"'
  }

  // 生成 checkbox HTML - 注意：unchecked 时不输出 checked 属性
  const checkedAttr = isChecked ? ' checked' : ''
  const checkboxHtml = `<input type="checkbox" id="${checkboxId}" class="task-checkbox"${checkedAttr} data-task-index="${taskIndex}" data-task-status="${status}" />`

  // 将内容包装在 span 中，防止 flex 布局把子元素分散
  return `<li${newAttrs} data-task-index="${taskIndex}" data-task-status="${status}">${checkboxHtml}<span class="task-content">${content}</span></li>`
}

// 缓存已转换的图片
const imageCache = new Map<string, string>()

/**
 * Uint8Array 转 Base64
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 获取图片的 MIME 类型
 */
function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || 'png'
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
  }
  return mimeTypes[ext] || 'image/png'
}

/**
 * 将本地图片转换为 base64 data URL
 */
async function convertImageToBase64(imagePath: string): Promise<string> {
  // 检查缓存
  if (imageCache.has(imagePath)) {
    console.log('[parser] Using cached image:', imagePath)
    return imageCache.get(imagePath)!
  }

  console.log('[parser] Converting image to base64:', imagePath)
  try {
    const fileData = await readFile(imagePath)
    console.log('[parser] Image file read successfully, size:', fileData.length, 'bytes')
    const mimeType = getMimeType(imagePath)
    const base64 = uint8ArrayToBase64(fileData)
    const dataUrl = `data:${mimeType};base64,${base64}`
    // 缓存结果
    imageCache.set(imagePath, dataUrl)
    console.log('[parser] Image converted successfully, dataUrl length:', dataUrl.length)
    return dataUrl
  } catch (error) {
    console.error('[parser] Failed to read image:', imagePath, error)
    return imagePath // 返回原路径
  }
}

/**
 * 预处理 Markdown 内容，将本地图片路径转换为 base64
 * 注意：这是一个异步操作，需要在使用前完成
 */
export async function preprocessImages(content: string, baseDir?: string): Promise<string> {
  // 匹配 Markdown 图片语法: ![alt](path)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const matches: Array<{ full: string; alt: string; path: string }> = []

  let match
  while ((match = imageRegex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      alt: match[1],
      path: match[2],
    })
  }

  // 如果没有图片，直接返回
  if (matches.length === 0) {
    return content
  }

  // 处理每个图片
  for (const img of matches) {
    const { full, alt, path } = img

    console.log('[parser] Processing image:', { alt, path, baseDir })

    // 跳过已经处理过的 base64 图片和 URL
    if (isUrl(path)) {
      console.log('[parser] Skipping URL:', path)
      continue
    }

    // 相对路径（./ ../ 与裸相对路径，如 images/x.png）基于 baseDir 解析为绝对路径；
    // 无 baseDir 时保持原值（下方 isLocalPath 判 false 跳过）
    const absolutePath = resolveToAbsoluteImagePath(path, baseDir)
    if (absolutePath !== path) {
      console.log('[parser] Resolved relative path:', path, '->', absolutePath)
    }

    // 如果是本地路径，转换为 base64
    if (isLocalPath(absolutePath)) {
      console.log('[parser] Converting local path:', absolutePath)
      const base64Url = await convertImageToBase64(absolutePath)
      if (base64Url !== absolutePath) {
        // 替换原始 Markdown
        const newImg = `![${alt}](${base64Url})`
        content = content.replace(full, newImg)
        console.log('[parser] Replaced image in content')
      }
    } else {
      console.log('[parser] Path is not local, skipping:', absolutePath)
    }
  }

  return content
}

// Note: 同步版本的图片缓存可以在未来需要时使用
// const preprocessedContentCache = new Map<string, string>()

// PlantUML 行内语法正则
const PLANTUML_INLINE_REGEX = /@startuml([\s\S]*?)@enduml/g

// ==================== 代码区掩码 ====================
// 行内 @startuml 正则不理解 Markdown 结构：围栏代码块里的 plantuml 源码（带标记是常态）、
// 行内代码里的 `@startuml` 提及（如本文档）都会被误匹配、嵌套破坏。替换前先把这两类区域
// 掩码成占位符，替换完再还原。

// 围栏代码块：``` 或 ~~~，含信息串，到同款闭合行。
// 缩进不限（CommonMark 顶层要求 ≤3 空格，但 `!!!` admonition 内容整体缩进 4 空格、
// 顶层缩进代码块内也可能是围栏形态——掩码只是防 @startuml 误替换，渲染前原样还原，放宽安全）
const FENCE_BLOCK_REGEX = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm
// 行内代码 span（单反引号、单行；多反引号/跨行 span 罕见，不掩码）
const INLINE_CODE_REGEX = /`[^`\n]+`/g

const MASK_TOKEN_PREFIX = ' VIVIDMARK_CODE_MASK_'

function maskCodeSegments(content: string): { masked: string; segments: string[] } {
  const segments: string[] = []
  const mask = (match: string): string => {
    segments.push(match)
    return `${MASK_TOKEN_PREFIX}${segments.length - 1} `
  }
  // 先围栏（多行）后行内（单行），避免行内正则吃进围栏内部
  const masked = content.replace(FENCE_BLOCK_REGEX, mask).replace(INLINE_CODE_REGEX, mask)
  return { masked, segments }
}

function unmaskCodeSegments(content: string, segments: string[]): string {
  return content.replace(/ VIVIDMARK_CODE_MASK_(\d+) /g, (_m, i) => segments[Number(i)])
}

// 预处理 PlantUML 行内语法（@startuml...@enduml → 占位符，渲染走本地引擎）
function preprocessPlantUML(content: string): string {
  const { masked, segments } = maskCodeSegments(content)
  const replaced = masked.replace(PLANTUML_INLINE_REGEX, (match) => {
    try {
      // 先还原掩码再编码：图源码里若恰好有行内代码形态的行，取回的是原始内容
      return `${createPlantUmlPlaceholder(unmaskCodeSegments(match, segments))}\n`
    } catch (error) {
      console.error('[PlantUML] Placeholder creation failed:', error)
      return match
    }
  })
  return unmaskCodeSegments(replaced, segments)
}

/**
 * 解析 Markdown 为 HTML
 * @param content Markdown 内容
 * @param options.preserveImages 为 true 时保留本地图片的相对路径 src（站点导出用；
 *   资产按镜像目录复制，相对路径在站点中仍然有效，不做 convertFileSrc 转换）
 */
export function parseMarkdown(content: string, options?: { preserveImages?: boolean }): string {
  // 注意：同步版本不会预处理图片
  // 如果需要图片支持，请使用 parseMarkdownAsync

  // 重置任务索引
  resetTaskIndex()

  // 剥离文档开头的 YAML frontmatter（YAML 解析失败保守保留原文）
  const { body } = parseFrontmatter(content)

  // 预处理任务列表语法
  const contentWithTasks = preprocessTaskLists(body)

  // 预处理 PlantUML 行内语法
  const processedContent = preprocessPlantUML(contentWithTasks)

  // 渲染 markdown
  let html = md.render(processedContent, { preserveImages: options?.preserveImages === true })

  // 后处理任务列表（替换标记为 checkbox）
  html = postprocessTaskLists(html)

  return html
}

export interface ParseMarkdownOptions {
  /** 基础目录，用于解析相对路径图片（异步版转 base64） */
  baseDir?: string
  /** 保留本地图片相对路径 src（站点导出用，资产镜像复制，不做 convertFileSrc/base64 转换） */
  preserveImages?: boolean
  /** 把 PlantUML 占位符替换为内联 SVG（导出用；预览走 renderPlantUmlPlaceholders 渐进渲染） */
  inlinePlantUml?: boolean
}

/**
 * 异步解析 Markdown 为 HTML，支持本地图片与 PlantUML 本地渲染
 */
export async function parseMarkdownAsync(
  content: string,
  options?: ParseMarkdownOptions
): Promise<string> {
  // 重置任务索引
  resetTaskIndex()

  // 剥离文档开头的 YAML frontmatter（YAML 解析失败保守保留原文）
  const { body } = parseFrontmatter(content)

  // 预处理任务列表语法
  const contentWithTasks = preprocessTaskLists(body)

  const processedContent = await preprocessImages(contentWithTasks, options?.baseDir)
  // 预处理 PlantUML 行内语法
  const contentWithPlantUML = preprocessPlantUML(processedContent)

  // 渲染 markdown
  let html = md.render(contentWithPlantUML, {
    preserveImages: options?.preserveImages === true,
  })

  // 后处理任务列表（替换标记为 checkbox）
  html = postprocessTaskLists(html)

  // 导出路径：PlantUML 占位符 → 内联 SVG（预览路径由 renderPlantUmlPlaceholders 处理）
  if (options?.inlinePlantUml) {
    html = await inlinePlantUmlDiagrams(html)
  }

  return html
}

// 获取纯文本摘要
export function getExcerpt(content: string, maxLength: number = 100): string {
  const plainText = content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n/g, ' ')
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }
  return plainText.slice(0, maxLength) + '...'
}

// 导出 markdown-it 实例以便扩展
export { md }
