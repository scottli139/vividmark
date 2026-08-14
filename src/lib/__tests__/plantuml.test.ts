/**
 * PlantUML 本地渲染封装层测试
 * 真实引擎（@plantuml/core）需要 canvas，jsdom 跑不了——用 setPlantUmlEngineForTests 注入假引擎。
 * 覆盖：缓存、inflight 去重、串行队列（引擎共享内部状态，并发会互相覆盖）、失败重试、dark 透传。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderPlantUmlSvg, setPlantUmlEngineForTests, resetPlantUmlForTests } from '../plantuml'

interface RenderCall {
  lines: string[]
  targetId: string
  dark?: boolean
}

/** 假引擎：异步把 SVG 写进目标容器（模拟真实引擎的异步行为） */
function createFakeEngine(write: (host: HTMLElement, call: RenderCall) => void = defaultWrite) {
  const calls: RenderCall[] = []
  const engine = {
    render(lines: string[], targetId: string, options?: { dark?: boolean }) {
      const call: RenderCall = { lines, targetId, dark: options?.dark }
      calls.push(call)
      const host = document.getElementById(targetId)
      if (host) queueMicrotask(() => write(host, call))
    },
  }
  return { engine, calls }
}

function defaultWrite(host: HTMLElement, call: RenderCall) {
  const text = document.createTextNode(call.lines.join('\n'))
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('data-dark', String(call.dark === true))
  svg.appendChild(text)
  host.appendChild(svg)
}

describe('renderPlantUmlSvg', () => {
  beforeEach(() => {
    resetPlantUmlForTests()
  })

  it('renders source to inline SVG via detached container', async () => {
    const { engine } = createFakeEngine()
    setPlantUmlEngineForTests(engine)

    const svg = await renderPlantUmlSvg('@startuml\nA -> B\n@enduml')
    expect(svg).toContain('<svg')
    expect(svg).toContain('A -&gt; B')
    // 离屏容器用完即清理
    expect(document.querySelector('[id^="plantuml-render-"]')).toBeNull()
  })

  it('passes dark option through to the engine', async () => {
    const { engine, calls } = createFakeEngine()
    setPlantUmlEngineForTests(engine)

    await renderPlantUmlSvg('X', { dark: true })
    expect(calls[0].dark).toBe(true)
    await renderPlantUmlSvg('Y')
    expect(calls[1].dark).toBe(false)
  })

  it('caches results per source and dark flag', async () => {
    const { engine, calls } = createFakeEngine()
    setPlantUmlEngineForTests(engine)

    const first = await renderPlantUmlSvg('X')
    const second = await renderPlantUmlSvg('X')
    expect(second).toBe(first)
    expect(calls.length).toBe(1)

    // dark 是缓存键的一部分
    await renderPlantUmlSvg('X', { dark: true })
    expect(calls.length).toBe(2)
  })

  it('dedups concurrent renders of the same source', async () => {
    const { engine, calls } = createFakeEngine()
    setPlantUmlEngineForTests(engine)

    const [a, b] = await Promise.all([renderPlantUmlSvg('X'), renderPlantUmlSvg('X')])
    expect(calls.length).toBe(1)
    expect(a).toBe(b)
  })

  it('serializes renders of different sources (engine shares internal state)', async () => {
    let active = 0
    let maxActive = 0
    const engine = {
      render(lines: string[], targetId: string) {
        active++
        maxActive = Math.max(maxActive, active)
        const host = document.getElementById(targetId)!
        setTimeout(() => {
          defaultWrite(host, { lines, targetId })
          active--
        }, 5)
      },
    }
    setPlantUmlEngineForTests(engine)

    await Promise.all([renderPlantUmlSvg('A'), renderPlantUmlSvg('B'), renderPlantUmlSvg('C')])
    expect(maxActive).toBe(1)
  })

  it('rejects when the engine throws and allows later retry', async () => {
    let shouldFail = true
    const engine = {
      render(lines: string[], targetId: string) {
        if (shouldFail) throw new Error('boom')
        const host = document.getElementById(targetId)
        if (host) queueMicrotask(() => defaultWrite(host, { lines, targetId }))
      },
    }
    setPlantUmlEngineForTests(engine)

    await expect(renderPlantUmlSvg('X')).rejects.toThrow('boom')

    // 失败不污染缓存/队列，恢复后可重试
    shouldFail = false
    await expect(renderPlantUmlSvg('X')).resolves.toContain('<svg')
  })
})
