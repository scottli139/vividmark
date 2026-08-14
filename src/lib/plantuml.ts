// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plantuml-encoder has no type declarations
import { encode } from 'plantuml-encoder'
import { createLogger } from './logger'

const logger = createLogger('PlantUML')

/**
 * 生成 PlantUML 在线渲染服务的 SVG URL
 * 这是本地渲染失败时的回退路径（preview / WYSIWYG nodeview 共用）
 * @throws 编码失败时抛异常（调用方决定降级展示）
 */
export function getPlantUmlSvgUrl(content: string): string {
  const encoded = encode(content.trim())
  return `https://www.plantuml.com/plantuml/svg/${encoded}`
}

// ==================== 本地引擎（@plantuml/core，TeaVM 编译） ====================
//
// 引擎文件（plantuml.js ~7.2MB + viz-global.js ~1.4MB + openiconic.js）由
// vite-plugin-static-copy 拷贝到 vendor/plantuml/，首个 UML 图出现时才懒加载。
// 已知约束（官方文档）：
// - 同一 JS 上下文必须串行渲染（引擎共享内部状态，并发会静默互相覆盖）→ 下方队列
// - viz-global.js / openiconic.js 是 classic script，须先于引擎加载（注册全局 Viz 等）
// - dark 选项只有 render() 文档化 → 统一 detached div + MutationObserver 取 SVG
// - 引擎需要 canvas 2D：webview 无问题，jsdom 跑不了（单测用 setPlantUmlEngineForTests 注入）

interface PlantUmlEngine {
  render(lines: string[], targetId: string, options?: { dark?: boolean }): void
}

const VENDOR_BASE = `${import.meta.env.BASE_URL}vendor/plantuml`
const RENDER_TIMEOUT_MS = 15000
const CACHE_LIMIT = 200

let enginePromise: Promise<PlantUmlEngine> | null = null
let engineOverride: PlantUmlEngine | null = null
let renderQueue: Promise<unknown> = Promise.resolve()
let renderSeq = 0
const svgCache = new Map<string, string>()
const inflight = new Map<string, Promise<string>>()

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 已加载过（如重试/多处触发）直接复用
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

function loadEngine(): Promise<PlantUmlEngine> {
  if (engineOverride) return Promise.resolve(engineOverride)
  if (!enginePromise) {
    enginePromise = (async () => {
      await loadScript(`${VENDOR_BASE}/viz-global.js`)
      await loadScript(`${VENDOR_BASE}/openiconic.js`)
      return (await import(/* @vite-ignore */ `${VENDOR_BASE}/plantuml.js`)) as PlantUmlEngine
    })()
    enginePromise.catch(() => {
      // 加载失败允许下次重试（dev server 重启、资源后补等场景可自愈）
      enginePromise = null
    })
  }
  return enginePromise
}

/**
 * 用引擎把源码渲染进离屏容器，等 SVG 出现后提取 HTML。
 * 语法错误在 PlantUML 里也会产出「错误示意图」SVG，故 reject 只发生在引擎级故障/超时。
 */
function renderWithEngine(engine: PlantUmlEngine, source: string, dark: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const host = document.createElement('div')
    host.id = `plantuml-render-${++renderSeq}`
    // 离屏但参与布局（不用 display:none，避免影响引擎内部测量）
    host.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;'
    document.body.appendChild(host)

    const cleanup = () => {
      observer.disconnect()
      clearTimeout(timer)
      host.remove()
    }
    const observer = new MutationObserver(() => {
      if (host.querySelector('svg')) {
        const svg = host.innerHTML
        cleanup()
        resolve(svg)
      }
    })
    observer.observe(host, { childList: true, subtree: true })
    const timer = setTimeout(() => {
      const hint = host.textContent?.trim().slice(0, 200)
      cleanup()
      reject(new Error(`PlantUML render timeout${hint ? `: ${hint}` : ''}`))
    }, RENDER_TIMEOUT_MS)
    try {
      engine.render(source.split(/\r\n|\r|\n/), host.id, { dark })
    } catch (error) {
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

function cacheSvg(key: string, svg: string): void {
  svgCache.set(key, svg)
  if (svgCache.size > CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value
    if (oldest !== undefined) svgCache.delete(oldest)
  }
}

/**
 * 本地渲染 PlantUML 源码为 SVG 字符串（离线，无网络请求）。
 * 失败时 reject —— 调用方决定回退在线服务或展示错误态。
 */
export async function renderPlantUmlSvg(
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
    const engine = await loadEngine()
    // 串行渲染：引擎共享内部状态，并发会互相覆盖（官方文档明示）
    const result = renderQueue.then(() => renderWithEngine(engine, source, dark))
    renderQueue = result.catch(() => undefined)
    const svg = await result
    cacheSvg(key, svg)
    return svg
  })()

  inflight.set(key, task)
  try {
    return await task
  } catch (error) {
    logger.warn('Local render failed, caller may fall back to online service:', error)
    throw error
  } finally {
    inflight.delete(key)
  }
}

/** 测试注入假引擎（jsdom 无 canvas，真引擎跑不了） */
export function setPlantUmlEngineForTests(engine: PlantUmlEngine | null): void {
  engineOverride = engine
}

export function resetPlantUmlForTests(): void {
  enginePromise = null
  engineOverride = null
  renderQueue = Promise.resolve()
  svgCache.clear()
  inflight.clear()
}
