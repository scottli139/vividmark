/**
 * PlantUML 代码块 nodeview 测试
 * - 本地引擎渲染内联 SVG（此处 mock 渲染器；真引擎需 canvas，jsdom 跑不了）
 * - 本地渲染失败回退在线 img；getPlantUmlSvgUrl 是在线回退的 URL 生成逻辑
 * - nodeview：预览 + 可编辑源码双区；序列化走原 code_block 路径（无损）
 * - 语言切换 plantuml ↔ 其他 时 nodeview 重建
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { getMarkdown, replaceAll } from '@milkdown/kit/utils'
import { getPlantUmlSvgUrl, renderPlantUmlSvg } from '../../../lib/plantuml'
import { wysiwygPlugins } from '../wysiwygPlugins'

// 本地引擎需要 canvas（jsdom 跑不了），mock 渲染函数；在线回退 URL 保留真实实现
vi.mock('../../../lib/plantuml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/plantuml')>()
  return { ...actual, renderPlantUmlSvg: vi.fn() }
})

describe('plantuml code block view', () => {
  let editor: Editor | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.mocked(renderPlantUmlSvg).mockReset()
    vi.mocked(renderPlantUmlSvg).mockResolvedValue('<svg data-test="local"></svg>')
  })

  afterEach(async () => {
    await editor?.destroy()
    editor = null
    container?.remove()
    container = null
  })

  async function createEditor(markdown: string): Promise<Editor> {
    container = document.createElement('div')
    document.body.appendChild(container)
    editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container)
        ctx.set(defaultValueCtx, markdown)
      })
      .use(wysiwygPlugins)
      .create()
    return editor
  }

  it('getPlantUmlSvgUrl builds deterministic svg urls', () => {
    const url = getPlantUmlSvgUrl('@startuml\nA -> B\n@enduml')
    expect(url).toMatch(/^https:\/\/www\.plantuml\.com\/plantuml\/svg\//)
    // 同样内容编码结果一致；不同内容不同
    expect(getPlantUmlSvgUrl('@startuml\nA -> B\n@enduml')).toBe(url)
    expect(getPlantUmlSvgUrl('@startuml\nC -> D\n@enduml')).not.toBe(url)
  })

  it('renders local SVG preview plus editable source for plantuml blocks', async () => {
    await createEditor('```plantuml\n@startuml\nA -> B\n@enduml\n```')

    const block = container!.querySelector('.plantuml-block')
    expect(block).toBeInTheDocument()
    // 本地引擎异步渲染：先占位，后内联 SVG
    await vi.waitFor(() => {
      expect(block!.querySelector('.plantuml-diagram svg[data-test="local"]')).toBeInTheDocument()
    })
    expect(renderPlantUmlSvg).toHaveBeenCalledWith('@startuml\nA -> B\n@enduml', {
      dark: expect.any(Boolean),
    })
    const preview = block!.querySelector('.plantuml-diagram')
    expect(preview!.closest('[contenteditable="false"]')).toBeTruthy()
    // 源码区保留（pre>code，内容是 PM 文档的一部分）
    const code = block!.querySelector('pre code')
    expect(code?.textContent).toContain('@startuml')
  })

  it('falls back to online image when local render fails', async () => {
    vi.mocked(renderPlantUmlSvg).mockRejectedValue(new Error('engine unavailable'))
    await createEditor('```plantuml\n@startuml\nA -> B\n@enduml\n```')

    const block = container!.querySelector('.plantuml-block')
    await vi.waitFor(() => {
      const img = block!.querySelector<HTMLImageElement>('.plantuml-diagram img')
      expect(img).toBeInTheDocument()
      expect(img!.src).toBe(getPlantUmlSvgUrl('@startuml\nA -> B\n@enduml'))
    })
  })

  it('serializes plantuml blocks losslessly', async () => {
    const ed = await createEditor('')
    const src = '```plantuml\n@startuml\nAlice -> Bob: hi\n@enduml\n```'
    ed.action(replaceAll(src, true))
    expect(ed.action(getMarkdown())).toBe(`${src}\n`)
  })

  it('renders non-plantuml code blocks as plain pre>code', async () => {
    await createEditor('```js\nconst a = 1\n```')
    expect(container!.querySelector('.plantuml-block')).not.toBeInTheDocument()
    const pre = container!.querySelector('pre')
    expect(pre).toBeInTheDocument()
    expect(pre!.querySelector('code')?.textContent).toContain('const a = 1')
    // 代码块内禁用拼写检查（红波浪线噪音）；autocorrect 已在编辑器根全局禁用
    expect(pre!.spellcheck).toBe(false)
  })

  it('rebuilds nodeview when language changes away from plantuml', async () => {
    const ed = await createEditor('```plantuml\n@startuml\nA -> B\n@enduml\n```')
    expect(container!.querySelector('.plantuml-block')).toBeInTheDocument()

    // 把 language 改为 js → nodeview 应重建为普通 pre
    ed.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      let pos = -1
      view.state.doc.descendants((node, p) => {
        if (node.type.name === 'code_block') pos = p
      })
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { language: 'js' }))
    })

    expect(container!.querySelector('.plantuml-block')).not.toBeInTheDocument()
    expect(container!.querySelector('pre code')?.textContent).toContain('@startuml')
    // 序列化反映新语言
    expect(ed.action(getMarkdown())).toContain('```js')
  })
})
