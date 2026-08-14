import { parse as parseYaml } from 'yaml'

/**
 * YAML frontmatter 解析（纯函数）。
 *
 * 供三处共用：预览剥离（parser.ts）、WYSIWYG 大纲去噪（outlineUtils.ts）、
 * 站点导出配置感知（siteConfig.ts / siteGenerator.ts / exportSite.ts）。
 * siteConfig.ts 对本模块做了再导出，历史导入路径保持可用。
 */

/** 文档开头 frontmatter 块（`---` 围栏，仅文档起始位置生效；无闭合围栏不匹配） */
export const FRONTMATTER_BLOCK_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export interface FrontmatterResult {
  /** 解析成功的 YAML 数据（非对象或解析失败为 null） */
  data: Record<string, unknown> | null
  /** 剥离 frontmatter 后的正文（无 frontmatter 或解析失败时为原文） */
  body: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 解析并剥离文档开头的 YAML frontmatter。
 * 无闭合围栏 / 非文档开头 → 按无 frontmatter 处理；YAML 解析失败保守返回原文（不剥离）。
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(FRONTMATTER_BLOCK_RE)
  if (!match) return { data: null, body: content }
  const body = content.slice(match[0].length)
  try {
    const data: unknown = parseYaml(match[1])
    return { data: isPlainObject(data) ? data : null, body }
  } catch {
    return { data: null, body: content }
  }
}

/** 从 frontmatter 数据取页面标题（非字符串或空白返回 null） */
export function frontmatterTitle(data: Record<string, unknown> | null): string | null {
  const title = data?.title
  if (typeof title !== 'string') return null
  const trimmed = title.trim()
  return trimmed || null
}
