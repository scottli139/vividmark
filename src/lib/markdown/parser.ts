import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plantuml-encoder has no type declarations
import { encode } from 'plantuml-encoder'
import hljs from 'highlight.js'
import { readFile } from '@tauri-apps/plugin-fs'
import { convertFileSrc } from '@tauri-apps/api/core'
import { isLocalPath, isUrl } from '../imageUtils'

// 检查是否在 Tauri 环境中
function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI__
}

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

// Admonition 类型配置
const admonitionTypes = [
  'tip',
  'warning',
  'info',
  'note',
  'danger',
  'success',
  'hint',
  'important',
  'caution',
]

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

// 渲染 PlantUML 为图片
function renderPlantUML(content: string): string {
  try {
    const encoded = encode(content.trim())
    // 使用 PlantUML 在线服务
    const url = `https://www.plantuml.com/plantuml/svg/${encoded}`
    return `<div class="plantuml-diagram"><img src="${url}" alt="PlantUML Diagram" loading="lazy" /></div>`
  } catch (error) {
    console.error('[PlantUML] Encoding failed:', error)
    return `<pre class="hljs plantuml-error"><code>${MarkdownIt.prototype.utils.escapeHtml(content)}</code></pre>`
  }
}

// 配置 Admonition 容器
admonitionTypes.forEach((type) => {
  md.use(container, type, {
    render: function (tokens: { info: string; nesting: number }[], idx: number) {
      const token = tokens[idx]
      const info = token.info.trim().slice(type.length).trim()

      if (token.nesting === 1) {
        // 打开标签
        const title = info || type.charAt(0).toUpperCase() + type.slice(1)
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

// 自定义图片渲染规则
const defaultImageRender =
  md.renderer.rules.image ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.image = function (tokens, idx, options, _env, self) {
  const token = tokens[idx]
  const srcIndex = token.attrIndex('src')

  if (srcIndex >= 0) {
    const src = token.attrs![srcIndex][1]
    token.attrs![srcIndex][1] = convertImageSrc(src)
  }

  return defaultImageRender(tokens, idx, options, _env, self)
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
    (match, attrs, taskIndex, status, content) => {
      return createTaskListItemHtml(attrs, taskIndex, status, content)
    }
  )

  // 处理普通情况
  // 格式: <li>\n[[TASK:0:checked]] 任务文本\n</li>
  html = html.replace(
    /<li([^>]*)>\s*\[\[TASK:(\d+):(\w+)\]\]\s*([\s\S]*?)<\/li>/g,
    (match, attrs, taskIndex, status, content) => {
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
    newAttrs = trimmedAttrs.replace(
      /class="([^"]*)"/,
      `class="${existingClass} task-list-item"`
    )
  } else if (trimmedAttrs) {
    // 有其他属性但没有 class，添加 class
    newAttrs = `${trimmedAttrs} class="task-list-item"`
  } else {
    // 没有任何属性
    newAttrs = ' class="task-list-item"'
  }

  // 生成 checkbox HTML - 注意：unchecked 时不输出 checked 属性
  const checkedAttr = isChecked ? ' checked' : ''
  const checkboxHtml = `<input type="checkbox" id="${checkboxId}" class="task-checkbox"${checkedAttr} data-task-index="${taskIndex}" />`

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
 * 解析相对路径为绝对路径
 */
function resolveRelativePath(relativePath: string, baseDir: string): string {
  if (relativePath.startsWith('./')) {
    return `${baseDir}/${relativePath.slice(2)}`
  } else if (relativePath.startsWith('../')) {
    // 处理上级目录
    const parts = baseDir.split('/')
    const relativeParts = relativePath.split('/')
    let upCount = 0
    for (const part of relativeParts) {
      if (part === '..') {
        upCount++
      } else {
        break
      }
    }
    const newBase = parts.slice(0, parts.length - upCount).join('/')
    const remaining = relativeParts.slice(upCount).join('/')
    return `${newBase}/${remaining}`
  }
  return `${baseDir}/${relativePath}`
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

    let absolutePath = path

    // 如果是相对路径且有 baseDir，转换为绝对路径
    if (path.startsWith('./') || path.startsWith('../')) {
      if (baseDir) {
        absolutePath = resolveRelativePath(path, baseDir)
        console.log('[parser] Resolved relative path:', path, '->', absolutePath)
      } else {
        // 没有 baseDir，跳过相对路径
        console.warn('[parser] Skipping relative path without baseDir:', path)
        continue
      }
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

// 预处理 PlantUML 行内语法
function preprocessPlantUML(content: string): string {
  return content.replace(PLANTUML_INLINE_REGEX, (_match, p1) => {
    try {
      const encoded = encode(p1.trim())
      const url = `https://www.plantuml.com/plantuml/svg/${encoded}`
      return `<div class="plantuml-diagram"><img src="${url}" alt="PlantUML Diagram" loading="lazy" /></div>\n`
    } catch (error) {
      console.error('[PlantUML] Encoding failed:', error)
      return _match
    }
  })
}

/**
 * 解析 Markdown 为 HTML
 * @param content Markdown 内容
 * @param baseDir 可选的基础目录，用于解析相对路径
 */
export function parseMarkdown(content: string): string {
  // 注意：同步版本不会预处理图片
  // 如果需要图片支持，请使用 parseMarkdownAsync
  // 如果需要 baseDir 支持，可以在未来添加

  // 重置任务索引
  resetTaskIndex()

  // 预处理任务列表语法
  const contentWithTasks = preprocessTaskLists(content)

  // 预处理 PlantUML 行内语法
  const processedContent = preprocessPlantUML(contentWithTasks)

  // 渲染 markdown
  let html = md.render(processedContent)

  // 后处理任务列表（替换标记为 checkbox）
  html = postprocessTaskLists(html)

  return html
}

/**
 * 异步解析 Markdown 为 HTML，支持本地图片
 * @param content Markdown 内容
 * @param baseDir 可选的基础目录，用于解析相对路径
 */
export async function parseMarkdownAsync(content: string, baseDir?: string): Promise<string> {
  // 重置任务索引
  resetTaskIndex()

  // 预处理任务列表语法
  const contentWithTasks = preprocessTaskLists(content)

  const processedContent = await preprocessImages(contentWithTasks, baseDir)
  // 预处理 PlantUML 行内语法
  const contentWithPlantUML = preprocessPlantUML(processedContent)

  // 渲染 markdown
  let html = md.render(contentWithPlantUML)

  // 后处理任务列表（替换标记为 checkbox）
  html = postprocessTaskLists(html)

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
