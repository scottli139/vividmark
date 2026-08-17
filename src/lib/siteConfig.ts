import { parse as parseYaml } from 'yaml'

/**
 * 站点导出「配置感知」：mkdocs / vuepress 仓库的风味探测与 mkdocs 配置解析。
 * 方案见 docs/site-export-config-plan.md —— 核心原则：配置只影响导航树与导出范围，
 * 从不删减页面；nav 是策展白名单，未收录页面照常导出但不进导航。
 *
 * 除 detectSiteFlavor 外均为纯函数（可单测）；detectSiteFlavor 经 FlavorIo 注入 IO，
 * 测试注入假实现即可覆盖全部分支。
 */

/** 仓库风味 */
export type SiteFlavor = 'plain' | 'mkdocs' | 'vuepress'

/** mkdocs nav 条目（YAML 单项 map 解析后的结构） */
export interface MkdocsNavItem {
  title: string
  /** 相对 docs_dir 的页面路径（已规范化：'\' → '/'、剥 './' 与尾部 '/'） */
  path?: string
  /** 外部链接（带 scheme、// 或 / 开头） */
  url?: string
  children?: MkdocsNavItem[]
}

/** mkdocs.yml 解析结果（仅取导出关心的字段） */
export interface MkdocsConfig {
  siteName?: string
  docsDir?: string
  nav?: MkdocsNavItem[]
  /** exclude_docs 原始模式串（.gitignore 格式，相对 docs_dir；含 `!` 取反、`/` 锚定标记） */
  excludeDocs?: string[]
}

/** 风味探测结果 */
export interface SiteFlavorInfo {
  flavor: SiteFlavor
  /** 导出范围根（相对打开目录，如 'docs'；'' = 打开目录本身） */
  docsRoot: string
  /** mkdocs 配置文件绝对路径（mkdocs 风味时存在） */
  mkdocsConfigPath?: string
  /** 已解析的 mkdocs 配置（命中时随结果返回，避免二次读取） */
  mkdocsConfig?: MkdocsConfig
  /** vuepress 配置文件绝对路径（探测到时存在） */
  vuepressConfigPath?: string
  /** vuepress config 正则提取的站点名（best-effort，见 vuepressSiteTitle） */
  vuepressSiteName?: string
  /** 非致命异常说明（配置解析失败 / docs_dir 不存在回退等），供调用方记日志 */
  warning?: string
}

/** 风味探测所需的最小 IO（测试注入假实现） */
export interface FlavorIo {
  fileExists(path: string): Promise<boolean>
  readTextFile(path: string): Promise<string>
}

const MKDOCS_CONFIG_NAMES = ['mkdocs.yml', 'mkdocs.yaml']

/** 外链判定：带 scheme（http:/mailto: 等）、// 开头、或站点根绝对路径 */
function isExternalUrl(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) || value.startsWith('//') || value.startsWith('/')
}

/** nav 路径规范化：'\' → '/'、剥 './' 前缀与尾部 '/' */
function normalizeNavPath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

/** docs_dir 规范化：非字符串缺省 'docs'；'.'/'' 视为配置所在目录本身 */
function normalizeDocsDir(value: unknown): string {
  if (typeof value !== 'string') return 'docs'
  const normalized = normalizeNavPath(value.trim())
  return normalized === '.' ? '' : normalized
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseNavItem(item: unknown): MkdocsNavItem | null {
  if (!isPlainObject(item)) return null
  const entries = Object.entries(item)
  if (entries.length !== 1) return null
  const [title, value] = entries[0]
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (isExternalUrl(trimmed)) return { title, url: trimmed }
    return { title, path: normalizeNavPath(trimmed) }
  }
  if (Array.isArray(value)) {
    const children = value
      .map(parseNavItem)
      .filter((child): child is MkdocsNavItem => child !== null)
    return { title, children }
  }
  return null
}

/**
 * exclude_docs 解析（mkdocs 1.5+）。官方格式为多行字符串（.gitignore 风格，
 * 文档示例含行内注释）；兼容 YAML 字符串数组写法。返回原始模式串列表
 * （保留 `!` 取反与 `/` 锚定标记，匹配语义见 compileExcludePatterns）。
 */
function parseExcludeDocs(value: unknown): string[] {
  const lines =
    typeof value === 'string'
      ? value.split(/\r?\n/)
      : Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : []
  return lines
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

/**
 * 解析 mkdocs.yml 文本（site_name / docs_dir / nav / exclude_docs）。
 * YAML 语法错误会抛异常，由调用方降级处理。
 */
export function parseMkdocsConfig(yamlText: string): MkdocsConfig {
  const raw: unknown = parseYaml(yamlText)
  if (!isPlainObject(raw)) return {}

  const config: MkdocsConfig = {}
  if (typeof raw.site_name === 'string' && raw.site_name.trim()) {
    config.siteName = raw.site_name.trim()
  }
  config.docsDir = normalizeDocsDir(raw.docs_dir)
  if (Array.isArray(raw.nav)) {
    const nav = raw.nav.map(parseNavItem).filter((item): item is MkdocsNavItem => item !== null)
    if (nav.length > 0) config.nav = nav
  }
  const excludeDocs = parseExcludeDocs(raw.exclude_docs)
  if (excludeDocs.length > 0) config.excludeDocs = excludeDocs
  return config
}

// ==================== exclude_docs 匹配（.gitignore 模式语义） ====================

/** 编译后的排除模式 */
export interface CompiledExcludePattern {
  regex: RegExp
  negated: boolean
}

/** gitignore glob → regex 主体：`*`/`?` 不跨 `/`；`**` 支持跨目录层级（前导任意层级、结尾递归） */
function globToRegexSource(glob: string): string {
  let out = ''
  let i = 0
  while (i < glob.length) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        const prevBoundary = i === 0 || glob[i - 1] === '/'
        if (prevBoundary && glob[i + 2] === '/') {
          out += '(?:.*/)?' // `**/x`：零层也匹配
          i += 3
          continue
        }
        if (prevBoundary && i + 2 >= glob.length) {
          out += '.*' // 结尾 `x/**`：内部一切
          i += 2
          continue
        }
        out += '[^/]*' // 段内 `**` 退化为 `*`
        i += 2
        continue
      }
      out += '[^/]*'
      i++
      continue
    }
    if (ch === '?') {
      out += '[^/]'
      i++
      continue
    }
    if (ch === '[') {
      const close = glob.indexOf(']', i + 1)
      if (close > i + 1) {
        out += glob.slice(i, close + 1) // 字符类原样保留
        i = close + 1
        continue
      }
      out += '\\['
      i++
      continue
    }
    out += ch.replace(/[.+^${}()|\\]/g, '\\$&')
    i++
  }
  return out
}

/**
 * 编译 .gitignore 风格模式（相对 docs_dir 的 '/' 分隔路径）：
 * - `!` 前缀取反（重新纳入）；按序评估，最后命中者决定
 * - 含 `/`（或前导 `/`）的模式锚定根；否则匹配任意层级
 * - 尾部 `/` 仅匹配目录（其下文件全部排除）；无尾 `/` 同时匹配文件与目录前缀
 */
export function compileExcludePatterns(patterns: string[]): CompiledExcludePattern[] {
  const compiled: CompiledExcludePattern[] = []
  for (const raw of patterns) {
    let pattern = raw
    let negated = false
    if (pattern.startsWith('!')) {
      negated = true
      pattern = pattern.slice(1)
    }
    const dirOnly = pattern.endsWith('/')
    if (dirOnly) pattern = pattern.slice(0, -1)
    const anchored = pattern.startsWith('/') || pattern.includes('/')
    if (pattern.startsWith('/')) pattern = pattern.slice(1)
    if (pattern === '') continue

    const body = globToRegexSource(pattern)
    const prefix = anchored ? '^' : '^(.*/)?'
    const suffix = dirOnly ? '/' : '(/.*)?$'
    compiled.push({ regex: new RegExp(prefix + body + suffix), negated })
  }
  return compiled
}

/** gitignore 语义匹配：按序评估全部模式，最后命中者决定（`!` 取反可重新纳入） */
export function isExcludedPath(patterns: CompiledExcludePattern[], relPath: string): boolean {
  let excluded = false
  for (const pattern of patterns) {
    if (pattern.regex.test(relPath)) excluded = !pattern.negated
  }
  return excluded
}

// frontmatter 纯函数已迁移至 ./markdown/frontmatter（预览剥离 / 大纲 / 站点导出共用），
// 此处再导出保持历史导入路径（siteGenerator / exportSite / 测试）可用
export {
  FRONTMATTER_BLOCK_RE,
  frontmatterTitle,
  parseFrontmatter,
  type FrontmatterResult,
} from './markdown/frontmatter'

// ==================== vuepress best-effort ====================

/** vuepress 配置文件探测顺序（v1 = config.js；v2 推荐 config.ts；均命中即停） */
const VUEPRESS_CONFIG_NAMES = ['config.ts', 'config.js', 'config.mjs']

/**
 * 从 vuepress config 文本正则提取 title（best-effort，已决策不做受限求值——
 * config 是可执行 JS，正则注定覆盖不全，提取不到时调用方回退目录名）。
 * 先剥块注释与整行 `//` 注释（案例仓库实测存在注释掉的配置项），再取首个
 * `title: '...'` / `"..."` / `` `...` `` 匹配（`. ` 不跨行，多行标题不追）。
 */
export function vuepressSiteTitle(configText: string): string | undefined {
  const stripped = configText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const match =
    /\btitle\s*:\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/.exec(stripped)
  const value = match?.[1] ?? match?.[2] ?? match?.[3]
  if (!value) return undefined
  const unescaped = value.replace(/\\(['"`\\])/g, '$1').trim()
  return unescaped || undefined
}

/** 读取 vuepress 配置并提取站点名；读取失败返回 warning（不抛，best-effort 降级） */
async function readVuepressSiteName(
  io: FlavorIo,
  vuepressDir: string
): Promise<{ configPath?: string; siteName?: string; warning?: string }> {
  for (const name of VUEPRESS_CONFIG_NAMES) {
    const configPath = `${vuepressDir}/${name}`
    if (!(await io.fileExists(configPath))) continue
    try {
      const text = await io.readTextFile(configPath)
      return { configPath, siteName: vuepressSiteTitle(text) }
    } catch (error) {
      return { configPath, warning: `vuepress 配置读取失败（${configPath}）：${String(error)}` }
    }
  }
  return {}
}

/** 读取并解析 mkdocs 配置；读取/解析失败返回 warning（不抛） */
async function readMkdocsConfig(
  io: FlavorIo,
  path: string
): Promise<{ config?: MkdocsConfig; warning?: string }> {
  try {
    const text = await io.readTextFile(path)
    return { config: parseMkdocsConfig(text) }
  } catch (error) {
    return { warning: `mkdocs 配置解析失败（${path}）：${String(error)}` }
  }
}

/**
 * 探测打开目录的仓库风味（命中即停，确定性优先级 mkdocs > vuepress）：
 * 1. 打开目录根有 mkdocs.yml/.yaml → mkdocs（docsRoot 取 docs_dir，缺省 'docs'；目录不存在告警退回 ''）
 * 2. 上一级有 mkdocs 配置且其 docs_dir 恰好解析回打开目录 → mkdocs（docsRoot ''）
 * 3. 打开目录根（或其 docs/ 下）有 .vuepress → vuepress
 * 4. 否则 plain
 */
export async function detectSiteFlavor(
  openedFolder: string,
  io: FlavorIo
): Promise<SiteFlavorInfo> {
  const root = openedFolder.replace(/\\/g, '/').replace(/\/+$/, '')

  for (const name of MKDOCS_CONFIG_NAMES) {
    const configPath = `${root}/${name}`
    if (!(await io.fileExists(configPath))) continue
    const { config, warning } = await readMkdocsConfig(io, configPath)
    if (!config) return { flavor: 'plain', docsRoot: '', warning }
    const docsRoot = config.docsDir ?? 'docs'
    if (docsRoot && !(await io.fileExists(`${root}/${docsRoot}`))) {
      return {
        flavor: 'mkdocs',
        docsRoot: '',
        mkdocsConfigPath: configPath,
        mkdocsConfig: config,
        warning: `docs_dir（${docsRoot}）不存在，导出范围退回打开目录本身`,
      }
    }
    return { flavor: 'mkdocs', docsRoot, mkdocsConfigPath: configPath, mkdocsConfig: config }
  }

  // 向上一级：父目录的 mkdocs.yml 且 docs_dir 指回本目录时才采信
  const slashIdx = root.lastIndexOf('/')
  if (slashIdx > 0) {
    const parent = root.slice(0, slashIdx)
    for (const name of MKDOCS_CONFIG_NAMES) {
      const configPath = `${parent}/${name}`
      if (!(await io.fileExists(configPath))) continue
      const { config } = await readMkdocsConfig(io, configPath)
      if (!config) continue
      const docsDir = config.docsDir ?? 'docs'
      if (`${parent}/${docsDir}` === root) {
        return {
          flavor: 'mkdocs',
          docsRoot: '',
          mkdocsConfigPath: configPath,
          mkdocsConfig: config,
        }
      }
    }
  }

  // vuepress：打开目录根（或其 docs/ 下）有 .vuepress；config title 尽力提取
  for (const docsRoot of ['', 'docs']) {
    const vuepressDir = docsRoot ? `${root}/${docsRoot}/.vuepress` : `${root}/.vuepress`
    if (!(await io.fileExists(vuepressDir))) continue
    const { configPath, siteName, warning } = await readVuepressSiteName(io, vuepressDir)
    return {
      flavor: 'vuepress',
      docsRoot,
      vuepressConfigPath: configPath,
      vuepressSiteName: siteName,
      warning,
    }
  }

  return { flavor: 'plain', docsRoot: '' }
}
