import { convertFileSrc } from '@tauri-apps/api/core'
import { isLocalPath, isUrl } from './imageUtils'

/**
 * 图片 src 解析 — preview 渲染（parser.ts）与 WYSIWYG 图片 nodeview 共用
 *
 * 只解析「显示用 URL」，不改写 Markdown 源文中的原始 src（序列化无损的前提）。
 */

// 检查是否在 Tauri 环境中
// 注意：Tauri v2 运行时总是注入 __TAURI_INTERNALS__（invoke 依赖它）；
// __TAURI__ 仅在 tauri.conf.json 开启 withGlobalTauri 时才存在（本项目未开启）
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return !!(w.__TAURI_INTERNALS__ || w.__TAURI__)
}

/**
 * 解析相对路径为绝对路径（统一 Windows `\` → `/` 约定）
 */
export function resolveRelativePath(relativePath: string, baseDir: string): string {
  // 统一转换为 POSIX 风格路径（处理 Windows 路径）
  const normalizedBase = baseDir.replace(/\\/g, '/')
  const normalizedRelative = relativePath.replace(/\\/g, '/')

  if (normalizedRelative.startsWith('./')) {
    return `${normalizedBase}/${normalizedRelative.slice(2)}`
  } else if (normalizedRelative.startsWith('../')) {
    // 处理上级目录
    const parts = normalizedBase.split('/').filter((p) => p.length > 0)
    const relativeParts = normalizedRelative.split('/')
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
    // 保留 Windows 盘符（如果有）
    const prefix = normalizedBase.startsWith('/') ? '/' : ''
    return `${prefix}${newBase}/${remaining}`
  }
  return `${normalizedBase}/${normalizedRelative}`
}

/** 从文档路径推导其所在目录（同时兼容 Windows `\` 与 Unix `/`） */
export function getBaseDirFromFilePath(filePath: string | null): string | undefined {
  if (!filePath) return undefined
  const lastSlash = filePath.lastIndexOf('/')
  const lastBackslash = filePath.lastIndexOf('\\')
  const separatorIndex = Math.max(lastSlash, lastBackslash)
  return separatorIndex > 0 ? filePath.substring(0, separatorIndex) : undefined
}

/** 判断是否为绝对路径（Unix `/` 或 Windows 盘符） */
export function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
}

/**
 * 把图片 src 解析为绝对本地路径：
 * - URL / data: / 协议相对 / 已是绝对路径 → 原样返回
 * - 相对路径（`./` `../` 与裸相对路径，如 `images/x.png`）→ 基于 baseDir 解析
 * - 无 baseDir 的相对路径 → 原样返回（无法解析）
 */
export function resolveToAbsoluteImagePath(src: string, baseDir?: string): string {
  if (!src || isUrl(src)) return src
  if (isAbsolutePath(src)) return src
  if (!baseDir) return src
  return resolveRelativePath(src, baseDir)
}

/**
 * 把图片 src 解析为可显示的 URL：
 * - http(s)/data:/protocol-relative 直接透传
 * - 相对路径（`./` `../` 与裸相对路径）先基于 baseDir 解析为绝对路径
 * - 本地路径在 Tauri 环境用 convertFileSrc 转换；非 Tauri 环境原样返回
 */
export function resolveImageSrc(src: string, baseDir?: string): string {
  if (!src || isUrl(src)) {
    return src
  }

  // convertFileSrc 只在 Tauri 运行时可用；其他环境保持原文
  if (!isTauri()) {
    return src
  }

  const path = resolveToAbsoluteImagePath(src, baseDir)

  if (isLocalPath(path)) {
    try {
      return convertFileSrc(path)
    } catch (error) {
      console.error('[resolveImageSrc] convertFileSrc failed:', error)
      return src
    }
  }

  return src
}
