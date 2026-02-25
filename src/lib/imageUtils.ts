/**
 * 图片处理工具
 *
 * 提供图片插入和处理功能
 */

import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'

/**
 * 打开文件选择对话框，选择本地图片
 * @returns 选择的图片路径，或 null 如果取消
 */
export async function selectLocalImage(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: 'Images',
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
    // 获取文件扩展名确定 MIME 类型
    const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'
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
 * 生成 Markdown 图片语法（异步，将本地图片转为 base64）
 * @param altText 替代文本
 * @param imagePath 图片路径或 URL
 * @returns Markdown 图片语法字符串
 */
export async function createImageMarkdown(altText: string, imagePath: string): Promise<string> {
  // 如果是本地路径，转换为 base64
  if (isLocalPath(imagePath)) {
    const base64Url = await imageToBase64(imagePath)
    if (base64Url) {
      return `![${altText}](${base64Url})`
    }
    // 如果转换失败，使用原路径
    console.warn('[imageUtils] Failed to convert to base64, using original path')
  }
  return `![${altText}](${imagePath})`
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

/**
 * 检查是否是本地文件路径
 * @param path 路径字符串
 * @returns 是否是本地路径
 */
export function isLocalPath(path: string): boolean {
  // 检查是否是绝对路径或相对路径
  // 排除已经转换的 data URL 和 http URL
  if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
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
  return path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')
}
