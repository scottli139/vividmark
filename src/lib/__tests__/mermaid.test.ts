/**
 * Mermaid 渲染封装层测试
 * 真实 mermaid 需要布局引擎，jsdom 跑不了——用 setMermaidRendererForTests 注入假渲染器。
 * 覆盖：缓存、inflight 去重、串行队列（全局配置 + body 临时容器，并发不安全）、
 *       失败重试、dark 透传。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderMermaidSvg, setMermaidRendererForTests, resetMermaidForTests } from '../mermaid'

interface RenderCall {
  source: string
  dark: boolean
}

/** 假渲染器：记录调用并返回携带 source/dark 的假 SVG */
function createFakeRenderer(write?: (call: RenderCall) => Promise<string>) {
  const calls: RenderCall[] = []
  const renderer = async (source: string, dark: boolean) => {
    const call: RenderCall = { source, dark }
    calls.push(call)
    return write ? write(call) : `<svg data-dark="${dark}">${source}</svg>`
  }
  return { renderer, calls }
}

describe('renderMermaidSvg', () => {
  beforeEach(() => {
    resetMermaidForTests()
  })

  it('renders source to SVG via renderer', async () => {
    const { renderer } = createFakeRenderer()
    setMermaidRendererForTests(renderer)

    const svg = await renderMermaidSvg('graph TD; A-->B')
    expect(svg).toContain('<svg')
    expect(svg).toContain('graph TD; A-->B')
  })

  it('passes dark option through to the renderer', async () => {
    const { renderer, calls } = createFakeRenderer()
    setMermaidRendererForTests(renderer)

    await renderMermaidSvg('X', { dark: true })
    expect(calls[0].dark).toBe(true)
    await renderMermaidSvg('Y')
    expect(calls[1].dark).toBe(false)
  })

  it('caches results per source and dark flag', async () => {
    const { renderer, calls } = createFakeRenderer()
    setMermaidRendererForTests(renderer)

    const first = await renderMermaidSvg('X')
    const second = await renderMermaidSvg('X')
    expect(second).toBe(first)
    expect(calls.length).toBe(1)

    // dark 是缓存键的一部分（主题切换要重渲）
    await renderMermaidSvg('X', { dark: true })
    expect(calls.length).toBe(2)
  })

  it('dedups concurrent renders of the same source', async () => {
    const { renderer, calls } = createFakeRenderer()
    setMermaidRendererForTests(renderer)

    const [a, b] = await Promise.all([renderMermaidSvg('X'), renderMermaidSvg('X')])
    expect(calls.length).toBe(1)
    expect(a).toBe(b)
  })

  it('serializes renders of different sources (render is globally stateful)', async () => {
    let active = 0
    let maxActive = 0
    const { renderer } = createFakeRenderer(async (call) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active--
      return `<svg>${call.source}</svg>`
    })
    setMermaidRendererForTests(renderer)

    await Promise.all([renderMermaidSvg('A'), renderMermaidSvg('B'), renderMermaidSvg('C')])
    expect(maxActive).toBe(1)
  })

  it('rejects when the renderer throws and allows later retry', async () => {
    let shouldFail = true
    const { renderer } = createFakeRenderer(async (call) => {
      if (shouldFail) throw new Error('Parse error on line 1')
      return `<svg>${call.source}</svg>`
    })
    setMermaidRendererForTests(renderer)

    await expect(renderMermaidSvg('X')).rejects.toThrow('Parse error')

    // 失败不污染缓存/队列，恢复后可重试
    shouldFail = false
    await expect(renderMermaidSvg('X')).resolves.toContain('<svg')
  })

  it('rewrites dominant-baseline="central" to alphabetic baseline + y offset (WebKit ignores it)', async () => {
    // WebKit 不认 <text> 的 dominant-baseline="central"（时序图 actor 文字偏高 ~0.35em）；
    // 改写为字母基线 + y 下移后双引擎一致。middle（messageText）不动；改绝对 y 而非 dy
    // （tspan 带 x/dy="0" 会锚定坐标使 text 的 dy 失效）
    const { renderer } = createFakeRenderer(
      async () =>
        '<svg><text x="281" y="19.5" dominant-baseline="central" alignment-baseline="central" class="actor actor-box" style="text-anchor: middle; font-size: 16px;"><tspan x="281" dy="0">用户</tspan></text>' +
        '<text x="50" y="10" dominant-baseline="middle" alignment-baseline="middle" dy="1em" class="messageText">hi</text></svg>'
    )
    setMermaidRendererForTests(renderer)

    const svg = await renderMermaidSvg('sequenceDiagram ...')
    expect(svg).not.toContain('dominant-baseline="central"')
    expect(svg).not.toContain('alignment-baseline="central"')
    // 19.5 + 16*0.35 = 25.1
    expect(svg).toContain('<text x="281" y="25.1" class="actor actor-box"')
    expect(svg).toContain('<tspan x="281" dy="0">用户</tspan>')
    // middle 的 messageText 保持原样
    expect(svg).toContain('dominant-baseline="middle"')
    expect(svg).toContain('class="messageText">hi</text>')
  })

  it('rewrites gitGraph branch label tspan dy="1em" to absolute y (WKWebView dy em deviation)', async () => {
    // 系统 WKWebView 解析 tspan dy="1em" 的 em 偏离 font-size，分支标签文字在 chip
    // 内偏下 ~4 单位；改写为规范上各引擎一致的绝对 y 消除歧义
    const { renderer } = createFakeRenderer(
      async () =>
        '<svg><style>.branch-label{font-size:16px;}</style>' +
        '<rect class="branchLabelBkg label0" x="-69" y="0.7" width="53" height="22.6" transform="translate(-19, -14)"></rect>' +
        '<g class="branchLabel"><g class="label branch-label0" transform="translate(-79, -13.3)">' +
        '<text><tspan xml:space="preserve" dy="1em" x="0" class="row">main</tspan></text></g></g></svg>'
    )
    setMermaidRendererForTests(renderer)

    const svg = await renderMermaidSvg('gitGraph ...')
    expect(svg).toContain('<tspan xml:space="preserve" x="0" class="row" y="16">main</tspan>')
    expect(svg).not.toContain('dy="1em"')
  })
})
