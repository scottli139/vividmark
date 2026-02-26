/**
 * 图片处理工具
 *
 * 提供图片插入和处理功能
 */

import { open } from '@tauri-apps/plugin-dialog'
import { readFile, copyFile, mkdir, exists } from '@tauri-apps/plugin-fs'
import { join, dirname, basename } from '@tauri-apps/api/path'
import i18n from '../i18n'

// 获取当前语言的翻译
function t(key: string): string {
  return i18n.t(key) as string
}

/**
 * 打开文件选择对话框，选择本地图片
 * @returns 选择的图片路径，或 null 如果取消
 */
export async function selectLocalImage(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: t('file.filters.images'),
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'],
      },
    ],
  })

  if (selected) {
    return selected as string
  }
  return null
}

/**
 * 获取文件扩展名
 */
function getExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || 'png'
}

/**
 * 检查是否是本地文件路径
 * @param path 路径字符串
 * @returns 是否是本地路径
 */
export function isLocalPath(path: string): boolean {
  // 排除 URL（data URL、http/https、protocol-relative）
  if (
    path.startsWith('data:') ||
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('//')
  ) {
    return false
  }
  return (
    path.startsWith('/') ||
    path.startsWith('./') ||
    path.startsWith('../') ||
    /^[A-Za-z]:/.test(path) // Windows 路径
  )
}

/**
 * 检查是否是 URL
 * @param path 路径字符串
 * @returns 是否是 URL
 */
export function isUrl(path: string): boolean {
  return (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('//')
  )
}

/**
 * 将图片复制到文档目录的 assets 文件夹，并返回相对路径
 * @param imagePath 原始图片路径
 * @param docPath 文档路径
 * @returns 相对路径或 null
 */
export async function copyImageToAssets(
  imagePath: string,
  docPath: string
): Promise<string | null> {
  try {
    const docDir = await dirname(docPath)
    const assetsDir = await join(docDir, 'assets')

    // 创建 assets 目录（如果不存在）
    const assetsExists = await exists(assetsDir)
    if (!assetsExists) {
      await mkdir(assetsDir, { recursive: true })
    }

    // 生成目标文件名（使用时间戳避免冲突）
    const originalName = await basename(imagePath)
    const timestamp = Date.now()
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const targetName = `${timestamp}_${safeName}`
    const targetPath = await join(assetsDir, targetName)

    // 复制文件
    await copyFile(imagePath, targetPath)

    // 返回相对路径
    return `./assets/${targetName}`
  } catch (error) {
    console.error('[imageUtils] Failed to copy image to assets:', error)
    return null
  }
}

/**
 * 计算相对路径
 * @param from 起始路径（文档路径）
 * @param to 目标路径（图片路径）
 */
function getRelativePath(fromDir: string, toPath: string): string {
  // 将路径分割为组件
  const fromParts = fromDir.split('/').filter((p) => p.length > 0)
  const toParts = toPath.split('/').filter((p) => p.length > 0)

  // 找到共同前缀
  let commonLength = 0
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++
    } else {
      break
    }
  }

  // 计算回退层数
  const upCount = fromParts.length - commonLength
  const remainingParts = toParts.slice(commonLength)

  // 构建相对路径
  const result = []
  for (let i = 0; i < upCount; i++) {
    result.push('..')
  }
  result.push(...remainingParts)

  return result.length > 0 ? `./${result.join('/')}` : './'
}

export interface ImageInsertOptions {
  /** 是否复制图片到文档目录的 assets 文件夹 */
  copyToAssets?: boolean
  /** 是否使用 base64（仅建议小图片使用） */
  useBase64?: boolean
}

/**
 * 生成 Markdown 图片语法
 *
 * 策略：
 * 1. 如果文档已保存且 copyToAssets=true：复制到 assets 文件夹，使用相对路径
 * 2. 如果文档已保存：使用相对于文档的路径
 * 3. 如果文档未保存或 useBase64=true：使用 base64（仅建议小图片 < 100KB）
 *
 * @param altText 替代文本
 * @param imagePath 图片路径
 * @param docPath 当前文档路径（可选）
 * @param options 插入选项
 * @returns Markdown 图片语法字符串
 */
export async function createImageMarkdown(
  altText: string,
  imagePath: string,
  docPath?: string | null,
  options: ImageInsertOptions = {}
): Promise<string> {
  const { copyToAssets = true, useBase64 = false } = options

  // 检查文件大小（如果超过 100KB，警告不建议使用 base64）
  let fileSize = 0
  try {
    const fileData = await readFile(imagePath)
    fileSize = fileData.length
  } catch {
    // 忽略读取错误
  }

  // 如果指定了使用 base64 且文件较小
  if (useBase64 && fileSize < 100 * 1024) {
    const base64Url = await imageToBase64(imagePath)
    if (base64Url) {
      return `![${altText}](${base64Url})`
    }
  }

  // 如果文档已保存
  if (docPath) {
    // 优先复制到 assets 文件夹
    if (copyToAssets) {
      const assetsPath = await copyImageToAssets(imagePath, docPath)
      if (assetsPath) {
        return `![${altText}](${assetsPath})`
      }
    }

    // 尝试使用相对路径
    const docDir = await dirname(docPath)
    const relPath = getRelativePath(docDir, imagePath)
    if (relPath && relPath !== imagePath) {
      return `![${altText}](${relPath})`
    }
  }

  // 使用绝对路径
  return `![${altText}](${imagePath})`
}

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
 * 将本地图片转换为 base64 data URL
 * @param imagePath 图片路径
 * @returns base64 data URL 或 null
 */
export async function imageToBase64(imagePath: string): Promise<string | null> {
  try {
    const fileData = await readFile(imagePath)
    const ext = getExtension(imagePath)
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
    }
    const mimeType = mimeTypes[ext] || 'image/png'
    const base64 = uint8ArrayToBase64(fileData)
    return `data:${mimeType};base64,${base64}`
  } catch (error) {
    console.error('[imageUtils] Failed to convert image to base64:', error)
    return null
  }
}

/**
 * 从 Markdown 图片语法中提取图片路径
 * @param markdown Markdown 图片语法
 * @returns 图片路径或 null
 */
export function extractImagePath(markdown: string): string | null {
  const match = markdown.match(/!\[.*?\]\((.*?)\)/)
  return match ? match[1] : null
}
