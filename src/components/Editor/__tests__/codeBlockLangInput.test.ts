/**
 * 代码块语言输入框测试
 * - 非 plantuml 代码块右上角渲染语言输入框（值 = language attr）
 * - Enter / blur 提交 → setNodeMarkup 更新 attr，序列化跟随
 * - Escape 还原不提交；输入 plantuml 触发 nodeview 重建为预览双区
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/kit/core'
import { getMarkdown } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('code block language input', () => {
  let editor: Editor | null = null
  let container: HTMLDivElement | null = null

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

  function pressKey(input: HTMLInputElement, key: string) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  }

  it('renders a language input reflecting the language attr', async () => {
    await createEditor('```js\nconst a = 1\n```')

    const input = container!.querySelector<HTMLInputElement>('pre .code-block-lang')
    expect(input).toBeInTheDocument()
    expect(input!.value).toBe('js')
    expect(input!.getAttribute('contenteditable')).toBe('false')
  })

  it('does not render the input for plantuml blocks', async () => {
    await createEditor('```plantuml\n@startuml\nA -> B\n@enduml\n```')

    expect(container!.querySelector('.code-block-lang')).not.toBeInTheDocument()
  })

  it('commits a new language on Enter and serialization follows', async () => {
    const ed = await createEditor('```\nplain code\n```')
    const input = container!.querySelector<HTMLInputElement>('pre .code-block-lang')!

    input.value = 'js'
    pressKey(input, 'Enter')

    expect(ed.action(getMarkdown())).toContain('```js')
    // 提交后输入框与新 attr 同步
    expect(container!.querySelector<HTMLInputElement>('pre .code-block-lang')!.value).toBe('js')
  })

  it('commits on blur', async () => {
    const ed = await createEditor('```\nplain code\n```')
    const input = container!.querySelector<HTMLInputElement>('pre .code-block-lang')!

    input.value = 'python'
    input.dispatchEvent(new FocusEvent('blur'))

    expect(ed.action(getMarkdown())).toContain('```python')
  })

  it('reverts on Escape without dispatching', async () => {
    const ed = await createEditor('```js\nconst a = 1\n```')
    const input = container!.querySelector<HTMLInputElement>('pre .code-block-lang')!

    input.value = 'python'
    pressKey(input, 'Escape')

    expect(ed.action(getMarkdown())).toContain('```js')
    expect(input.value).toBe('js')
  })

  it('rebuilds into plantuml preview when language becomes plantuml', async () => {
    await createEditor('```\n@startuml\nA -> B\n@enduml\n```')
    const input = container!.querySelector<HTMLInputElement>('pre .code-block-lang')!

    input.value = 'plantuml'
    pressKey(input, 'Enter')

    expect(container!.querySelector('.plantuml-block')).toBeInTheDocument()
    expect(container!.querySelector('.code-block-lang')).not.toBeInTheDocument()
  })

  it('syncs the input when the language changes externally (e.g. undo)', async () => {
    const ed = await createEditor('```js\nconst a = 1\n```')
    const input = container!.querySelector<HTMLInputElement>('pre .code-block-lang')!

    input.value = 'python'
    pressKey(input, 'Enter')
    expect(ed.action(getMarkdown())).toContain('```python')

    // 模拟外部 attr 变化（等价于 undo 的效果）
    ed.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      let pos = -1
      view.state.doc.descendants((node, p) => {
        if (node.type.name === 'code_block') pos = p
      })
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { language: 'js' }))
    })

    expect(container!.querySelector<HTMLInputElement>('pre .code-block-lang')!.value).toBe('js')
  })
})
