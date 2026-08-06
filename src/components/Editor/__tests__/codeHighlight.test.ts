/**
 * WYSIWYG 代码块语法高亮测试
 * - 显式已知语言的代码块挂 hljs-* inline decorations（与预览同一套 hljs 引擎/样式类）
 * - 无语言 / 未知语言 / plantuml 代码块不高亮
 * - 代码变更后高亮随之更新
 */
import { describe, it, expect, afterEach } from 'vitest'
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/kit/core'
import { replaceAll } from '@milkdown/kit/utils'
import { wysiwygPlugins } from '../wysiwygPlugins'

describe('wysiwyg code block highlight', () => {
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

  it('highlights code blocks with a known language', async () => {
    await createEditor('```js\nconst answer = 42\n```')

    const keyword = container!.querySelector('pre code .hljs-keyword')
    expect(keyword).toBeInTheDocument()
    expect(keyword!.textContent).toBe('const')
    expect(container!.querySelector('pre code .hljs-number')?.textContent).toBe('42')
  })

  it('does not highlight blocks without a language', async () => {
    await createEditor('```\nconst answer = 42\n```')

    expect(container!.querySelector('.hljs-keyword')).not.toBeInTheDocument()
    expect(container!.querySelector('pre code')?.textContent).toContain('const answer = 42')
  })

  it('does not highlight blocks with an unknown language', async () => {
    await createEditor('```notalanguage\nconst answer = 42\n```')

    expect(container!.querySelector('.hljs-keyword')).not.toBeInTheDocument()
  })

  it('does not highlight plantuml blocks (renders preview pane instead)', async () => {
    await createEditor('```plantuml\n@startuml\nA -> B\n@enduml\n```')

    expect(container!.querySelector('.plantuml-block')).toBeInTheDocument()
    expect(container!.querySelector('.hljs-keyword')).not.toBeInTheDocument()
  })

  it('rebuilds decorations when the code changes', async () => {
    const ed = await createEditor('```js\nconst a = 1\n```')
    expect(container!.querySelector('.hljs-keyword')?.textContent).toBe('const')

    ed.action(replaceAll('```js\nlet b = 2\n```', true))

    const keyword = container!.querySelector('.hljs-keyword')
    expect(keyword?.textContent).toBe('let')
    expect(container!.querySelector('.hljs-number')?.textContent).toBe('2')
  })
})
