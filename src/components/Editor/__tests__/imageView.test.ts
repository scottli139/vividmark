/**
 * 本地图片解析测试
 * - imageSrc.ts：resolveImageSrc / resolveRelativePath / getBaseDirFromFilePath 纯函数
 * - 图片 nodeview：相对路径解析（Tauri convertFileSrc）、attrs.src 保持原文（序列化无损）、
 *   网络图/data: 透传、加载失败占位
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/kit/core'
import { getMarkdown } from '@milkdown/kit/utils'
import {
  getBaseDirFromFilePath,
  resolveImageSrc,
  resolveRelativePath,
  resolveToAbsoluteImagePath,
} from '../../../lib/imageSrc'
import { useEditorStore } from '../../../stores/editorStore'
import { wysiwygPlugins } from '../wysiwygPlugins'

/** 模拟 Tauri 运行时：convertFileSrc 委托给 window.__TAURI_INTERNALS__（见 @tauri-apps/api/core） */
function mockTauriRuntime() {
  const w = window as unknown as Record<string, unknown>
  w.__TAURI__ = {}
  w.__TAURI_INTERNALS__ = {
    convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
  }
}

function unmockTauriRuntime() {
  const w = window as unknown as Record<string, unknown>
  delete w.__TAURI__
  delete w.__TAURI_INTERNALS__
}

describe('imageSrc', () => {
  it('resolves relative paths against baseDir', () => {
    expect(resolveRelativePath('./assets/x.png', '/docs')).toBe('/docs/assets/x.png')
    expect(resolveRelativePath('../img/y.png', '/docs/sub')).toBe('/docs/img/y.png')
    expect(resolveRelativePath('../../z.png', '/a/b/c')).toBe('/a/z.png')
  })

  it('handles Windows-style paths', () => {
    expect(resolveRelativePath('.\\assets\\x.png', 'C:\\docs')).toBe('C:/docs/assets/x.png')
    expect(resolveRelativePath('../y.png', 'C:\\docs\\sub')).toBe('C:/docs/y.png')
  })

  it('derives baseDir from file path (unix & windows)', () => {
    expect(getBaseDirFromFilePath('/docs/note.md')).toBe('/docs')
    expect(getBaseDirFromFilePath('C:\\docs\\note.md')).toBe('C:\\docs')
    expect(getBaseDirFromFilePath('note.md')).toBeUndefined()
    expect(getBaseDirFromFilePath(null)).toBeUndefined()
  })

  it('passes through urls and data urls', () => {
    expect(resolveImageSrc('https://a.com/x.png', '/docs')).toBe('https://a.com/x.png')
    expect(resolveImageSrc('data:image/png;base64,AAAA', '/docs')).toBe(
      'data:image/png;base64,AAAA'
    )
  })

  it('returns original src outside Tauri (no convertFileSrc available)', () => {
    // jsdom 非 Tauri 环境：保持原文（真实应用在 Tauri 内才转换）
    expect(resolveImageSrc('./assets/x.png', '/docs')).toBe('./assets/x.png')
    expect(resolveImageSrc('/abs/x.png', '/docs')).toBe('/abs/x.png')
  })

  it('converts local paths via convertFileSrc inside Tauri', () => {
    mockTauriRuntime()
    try {
      const out = resolveImageSrc('./assets/x.png', '/docs')
      // convertFileSrc 产出 asset URL（包含编码后的绝对路径）
      expect(out).not.toBe('./assets/x.png')
      expect(decodeURIComponent(out)).toContain('/docs/assets/x.png')
    } finally {
      unmockTauriRuntime()
    }
  })

  it('resolves bare relative paths (images/x.png) against baseDir', () => {
    expect(resolveToAbsoluteImagePath('images/x.png', '/docs')).toBe('/docs/images/x.png')
    expect(resolveToAbsoluteImagePath('./images/x.png', '/docs')).toBe('/docs/images/x.png')
    expect(resolveToAbsoluteImagePath('../x.png', '/docs/sub')).toBe('/docs/x.png')
    expect(resolveToAbsoluteImagePath('/abs/x.png', '/docs')).toBe('/abs/x.png')
    // 无 baseDir 与 URL 保持原文
    expect(resolveToAbsoluteImagePath('images/x.png')).toBe('images/x.png')
    expect(resolveToAbsoluteImagePath('https://a.com/x.png', '/docs')).toBe('https://a.com/x.png')
  })

  it('converts bare relative paths via convertFileSrc inside Tauri', () => {
    mockTauriRuntime()
    try {
      const out = resolveImageSrc('images/x.png', '/docs')
      expect(out).not.toBe('images/x.png')
      expect(decodeURIComponent(out)).toContain('/docs/images/x.png')
    } finally {
      unmockTauriRuntime()
    }
  })
})

describe('image nodeview', () => {
  let editor: Editor | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    useEditorStore.setState({ filePath: '/docs/note.md' })
  })

  afterEach(async () => {
    await editor?.destroy()
    editor = null
    container?.remove()
    container = null
    useEditorStore.setState({ filePath: null })
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

  it('renders img with original src in attrs (lossless serialization)', async () => {
    const ed = await createEditor('![本地图](./assets/x.png)')

    const img = container!.querySelector<HTMLImageElement>('.wysiwyg-image img')
    expect(img).toBeInTheDocument()
    expect(img!.alt).toBe('本地图')
    // 非 Tauri：DOM src 保持原文；序列化无损
    expect(img!.getAttribute('src')).toBe('./assets/x.png')
    expect(ed.action(getMarkdown())).toContain('![本地图](./assets/x.png)')
  })

  it('resolves relative src via convertFileSrc in Tauri env', async () => {
    mockTauriRuntime()
    try {
      await createEditor('![a](./assets/x.png)')
      const img = container!.querySelector<HTMLImageElement>('.wysiwyg-image img')
      const src = img!.getAttribute('src')!
      expect(src).not.toBe('./assets/x.png')
      expect(decodeURIComponent(src)).toContain('/docs/assets/x.png')
    } finally {
      unmockTauriRuntime()
    }
  })

  it('passes through network images', async () => {
    await createEditor('![web](https://example.com/y.png)')
    const img = container!.querySelector<HTMLImageElement>('.wysiwyg-image img')
    expect(img!.getAttribute('src')).toBe('https://example.com/y.png')
  })

  it('shows placeholder style when image fails to load', async () => {
    await createEditor('![broken](./missing.png)')
    const wrapper = container!.querySelector('.wysiwyg-image')!
    const img = wrapper.querySelector('img')!
    expect(wrapper.classList.contains('wysiwyg-image-load-error')).toBe(false)
    img.dispatchEvent(new Event('error'))
    expect(wrapper.classList.contains('wysiwyg-image-load-error')).toBe(true)
    expect(wrapper.querySelector('.wysiwyg-image-error')?.textContent).toContain('./missing.png')
  })

  it('zoom button opens the image viewer; stays inert when image is broken', async () => {
    await createEditor('![a](https://example.com/y.png)')
    const wrapper = container!.querySelector('.wysiwyg-image')!
    const img = wrapper.querySelector('img')!
    const button = wrapper.querySelector<HTMLButtonElement>('.diagram-zoom-button')
    expect(button).toBeInTheDocument()

    const received: string[] = []
    const handler = (e: Event) => received.push((e as CustomEvent<{ html: string }>).detail.html)
    window.addEventListener('app-open-image-viewer', handler)
    try {
      // 正常图：dispatch 查看器事件
      button!.click()
      expect(received).toHaveLength(1)
      expect(received[0]).toContain('https://example.com/y.png')

      // 破图占位态：不再 dispatch
      img.dispatchEvent(new Event('error'))
      button!.click()
      expect(received).toHaveLength(1)
    } finally {
      window.removeEventListener('app-open-image-viewer', handler)
    }
  })
})
