import { createLogger } from './logger'

const logger = createLogger('Mermaid')

// ==================== Mermaid 渲染封装（离线，懒加载） ====================
//
// mermaid npm 包体积大（chunk ~1MB+），dynamic import 拆包，首个 mermaid 代码块
// 出现时才加载。与 PlantUML 引擎同款约束与模式：
// - mermaid.initialize 是全局配置、render 内部向 body 挂临时容器量布局——并发渲染
//   历史上有互相踩的问题，统一串行队列最稳
// - 主题在渲染期确定（SVG 内联样式），dark 参数变化时重新 initialize 后重渲
// - jsdom 无布局引擎跑不了真渲染（单测用 setMermaidRendererForTests 注入）

type MermaidModule = typeof import('mermaid')

/** 实际执行一次渲染的函数形态（真实实现 = mermaid.render 包装；测试注入假实现） */
type MermaidRenderer = (source: string, dark: boolean) => Promise<string>

const CACHE_LIMIT = 200

let mermaidPromise: Promise<MermaidModule> | null = null
let rendererOverride: MermaidRenderer | null = null
let renderQueue: Promise<unknown> = Promise.resolve()
let renderSeq = 0
// 记录 initialize 时的主题：mermaid 主题是全局配置，dark 变化须重新 initialize
let initializedDark: boolean | null = null
const svgCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

function loadMermaid(): Promise<MermaidModule> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
    // 加载失败允许下次重试（dev server 重启、chunk 加载抖动等场景可自愈）
    mermaidPromise.catch(() => {
      mermaidPromise = null
    })
  }
  return mermaidPromise
}

/**
 * 用 mermaid.render 把源码渲染为 SVG 字符串。
 * 语法错误会 reject（suppressErrorRendering 阻止引擎把错误图形塞进 body），
 * 调用方负责展示错误态——没有可用的离线回退，不走在线服务。
 */
async function renderWithMermaid(source: string, dark: boolean): Promise<string> {
  const mermaid = (await loadMermaid()).default
  if (initializedDark !== dark) {
    mermaid.initialize({
      startOnLoad: false,
      theme: dark ? 'dark' : 'default',
      // 解析失败时自己渲染错误提示图形到 DOM；我们要自己展示错误态，关掉
      suppressErrorRendering: true,
      // 时序图角色框默认高 65px，相对 16px 文字上下留白过大 → 收紧到 46
      sequence: { height: 46 },
    })
    initializedDark = dark
  }
  const id = `mermaid-render-${++renderSeq}`
  try {
    const { svg } = await mermaid.render(id, source)
    return svg
  } finally {
    // render 成功后临时容器应已自清；失败/异常路径下兜底清掉，避免 body 残留
    document.getElementById(id)?.remove()
    document.getElementById(`d${id}`)?.remove()
  }
}

function cacheSvg(key: string, svg: string): void {
  svgCache.set(key, svg)
  if (svgCache.size > CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value
    if (oldest !== undefined) svgCache.delete(oldest)
  }
}

/**
 * WebKit 不认 <text> 的 dominant-baseline="central"（属性/CSS 形式都无视，退化为字母
 * 基线），时序图 actor 文字在 WKWebView 比 Chromium 偏高 ~0.35em。统一改写为字母基线 +
 * y 下移 0.35em（≈ 字体 (ascent−descent)/2，即 central 的本意），双引擎布局一致。
 * 注意不能加 dy——actor 文本的 tspan 带 x/dy="0" 会锚定坐标使 text 的 dy 失效，直接改
 * 绝对 y 才可靠。无 y 属性或 middle（messageText 等无包围盒文字）不动。
 */
function normalizeCentralBaseline(svg: string): string {
  return svg.replace(/<text\b[^>]*>/g, (tag) => {
    if (!tag.includes('dominant-baseline="central"')) return tag
    const yMatch = tag.match(/\by="(-?[\d.]+)"/)
    if (!yMatch) return tag
    const fontSize = Number(tag.match(/font-size:\s*([\d.]+)px/)?.[1] ?? 16)
    const newY = Math.round((Number(yMatch[1]) + fontSize * 0.35) * 100) / 100
    return tag
      .replace(/\s+dominant-baseline="central"/, '')
      .replace(/\s+alignment-baseline="central"/, '')
      .replace(/\by="(-?[\d.]+)"/, `y="${newY}"`)
  })
}

/**
 * 本地渲染 Mermaid 源码为 SVG 字符串（离线，无网络请求）。
 * 失败时 reject —— 调用方决定展示错误态（语法错误会携带 mermaid 的解析错误信息）。
 */
export async function renderMermaidSvg(
  source: string,
  options?: { dark?: boolean }
): Promise<string> {
  const dark = options?.dark === true
  const key = `${dark ? 'd' : 'l'}:${source}`

  const cached = svgCache.get(key)
  if (cached !== undefined) {
    // LRU：命中后提到最新
    svgCache.delete(key)
    svgCache.set(key, cached)
    return cached
  }

  const pending = inflight.get(key)
  if (pending) return pending

  const task = (async () => {
    const renderer = rendererOverride ?? renderWithMermaid
    // 串行渲染：mermaid.render 全局配置 + body 临时容器，并发不安全
    const result = renderQueue.then(() => renderer(source, dark))
    renderQueue = result.catch(() => undefined)
    const svg = normalizeCentralBaseline(await result)
    cacheSvg(key, svg)
    return svg
  })()

  inflight.set(key, task)
  try {
    return await task
  } catch (error) {
    logger.warn('Mermaid render failed, caller may show error state:', error)
    throw error
  } finally {
    inflight.delete(key)
  }
}

/** 测试注入假渲染器（jsdom 无布局引擎，真 mermaid 跑不了） */
export function setMermaidRendererForTests(renderer: MermaidRenderer | null): void {
  rendererOverride = renderer
}

export function resetMermaidForTests(): void {
  mermaidPromise = null
  rendererOverride = null
  renderQueue = Promise.resolve()
  initializedDark = null
  svgCache.clear()
  inflight.clear()
}
