import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockInvoke, mockOpenDialog, resetTauriMocks } from '../../test/mocks/tauri'
import { useEditorStore } from '../../stores/editorStore'
import type { FileTreeItem } from '../fileTreeUtils'

vi.mock('../dialog', () => ({ alertDialog: vi.fn().mockResolvedValue(undefined) }))

import { alertDialog } from '../dialog'
import { exportSite } from '../exportSite'

const mockAlertDialog = vi.mocked(alertDialog)

interface ExportedFile {
  path: string
  content?: string
  sourcePath?: string
}

function dir(name: string, children: FileTreeItem[], parent: string): FileTreeItem {
  return { name, path: `${parent}/${name}`, isDirectory: true, children }
}
function file(name: string, parent: string): FileTreeItem {
  return { name, path: `${parent}/${name}`, isDirectory: false }
}

let exportedFiles: ExportedFile[] = []
let exportedOutputDir = ''
let readDirPaths: string[] = []

/** mock invoke：files = 路径→文件内容；exists = 存在的路径（含目录） */
function setupInvoke(opts: {
  tree: FileTreeItem[]
  files: Record<string, string>
  exists?: Record<string, boolean>
}) {
  mockInvoke.mockImplementation(async (cmd: string, args?: unknown) => {
    const a = (args ?? {}) as {
      path?: string
      params?: { path?: string; outputDir?: string; files?: ExportedFile[] }
    }
    switch (cmd) {
      case 'read_directory':
        readDirPaths.push(a.params?.path ?? '')
        return opts.tree
      case 'read_file': {
        const path = a.path ?? ''
        if (path in opts.files) {
          return { path, content: opts.files[path], name: path.split('/').pop() }
        }
        throw new Error(`unexpected read_file: ${path}`)
      }
      case 'file_exists':
        return opts.exists?.[a.path ?? ''] === true
      case 'export_site':
        exportedFiles = a.params?.files ?? []
        exportedOutputDir = a.params?.outputDir ?? ''
        return { success: true, error: null, written: exportedFiles.length }
      default:
        return null
    }
  })
}

beforeEach(() => {
  resetTauriMocks()
  ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  mockOpenDialog.mockResolvedValue('/out')
  useEditorStore.setState({ openedFolder: '/repo' })
  exportedFiles = []
  exportedOutputDir = ''
  readDirPaths = []
})

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

describe('exportSite 编排（配置感知）', () => {
  it('非 Tauri 环境直接返回 false', async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
    expect(await exportSite()).toBe(false)
  })

  it('用户取消输出目录选择 → false 且不写盘', async () => {
    mockOpenDialog.mockResolvedValue(null)
    expect(await exportSite()).toBe(false)
    expect(mockInvoke).not.toHaveBeenCalledWith('export_site', expect.anything())
  })

  it('无 Markdown 页面 → 提示并中止', async () => {
    setupInvoke({ tree: [], files: {} })
    expect(await exportSite()).toBe(false)
    expect(mockAlertDialog).toHaveBeenCalledWith('No Markdown files found in the opened folder')
  })

  it('plain 风味：读打开目录本身、目录推导导航、frontmatter 剥离且 title 进导航', async () => {
    setupInvoke({
      tree: [file('README.md', '/repo'), file('guide.md', '/repo')],
      files: {
        '/repo/README.md': '# 首页标题\n',
        '/repo/guide.md': '---\ntitle: 使用指南\n---\n正文无标题段落\n',
      },
    })
    expect(await exportSite()).toBe(true)
    expect(readDirPaths).toEqual(['/repo'])
    expect(exportedOutputDir).toBe('/out/repo-site')

    const guide = exportedFiles.find((f) => f.path === 'guide.html')
    // frontmatter title 进导航与 <title>
    expect(guide?.content).toContain('使用指南')
    // frontmatter 不渲染（无 hr、无 yaml 文本）
    expect(guide?.content).not.toContain('<hr')
    expect(guide?.content).not.toContain('title:')
    // plain 成功提示（无配置来源说明）
    expect(mockAlertDialog).toHaveBeenCalledWith(
      expect.stringContaining('Site exported to: /out/repo-site')
    )
  })

  it('mkdocs 风味：范围收敛 docs_dir、site_name、nav 原文导航、缺文件跳过、页面集完整', async () => {
    setupInvoke({
      tree: [
        dir('svcsdk', [file('README.md', '/repo/docs/svcsdk')], '/repo/docs'),
        dir('other', [file('faq.md', '/repo/docs/other')], '/repo/docs'),
        dir('hidden', [file('notes.md', '/repo/docs/hidden')], '/repo/docs'),
      ],
      exists: { '/repo/mkdocs.yml': true, '/repo/docs': true },
      files: {
        '/repo/mkdocs.yml': `site_name: 中创视讯
docs_dir: ./docs
nav:
  - 首页: svcsdk/README.md
  - 其他:
    - 常见问题: other/faq.md
    - 已删除页面: ghost.md
  - 公司主页: http://www.hexmeet.com
`,
        '/repo/docs/svcsdk/README.md': '# SVC SDK\n',
        '/repo/docs/other/faq.md': '---\ntitle: 常见问题（frontmatter）\n---\n正文\n',
        '/repo/docs/hidden/notes.md': '# 内部笔记\n',
      },
    })
    expect(await exportSite()).toBe(true)

    // 范围收敛：读 docs/ 子树而非仓库根
    expect(readDirPaths).toEqual(['/repo/docs'])
    // 站点名取 site_name
    expect(exportedOutputDir).toBe('/out/中创视讯-site')

    const paths = exportedFiles.map((f) => f.path)
    // 页面集完整：未收录进 nav 的 hidden/notes.md 照常导出；无根 README → 生成重定向首页
    expect(paths).toEqual(
      expect.arrayContaining([
        'svcsdk/index.html',
        'other/faq.html',
        'hidden/notes.html',
        'index.html',
      ])
    )

    const home = exportedFiles.find((f) => f.path === 'svcsdk/index.html')
    // nav 原文：显式标题、分组、外链条目
    expect(home?.content).toContain('>首页</a>')
    expect(home?.content).toContain('>常见问题</a>')
    expect(home?.content).toContain('href="http://www.hexmeet.com"')
    expect(home?.content).toContain('target="_blank"')
    // nav 缺文件跳过；未收录页面不进导航
    expect(home?.content).not.toContain('ghost')
    expect(home?.content).not.toContain('内部笔记')
    // nav 标题优先于 frontmatter title
    expect(home?.content).not.toContain('常见问题（frontmatter）')

    // 未收录页面的 <title> 用自身 H1 回退
    const notes = exportedFiles.find((f) => f.path === 'hidden/notes.html')
    expect(notes?.content).toContain('<title>内部笔记 · 中创视讯</title>')

    // frontmatter 剥离渲染
    const faq = exportedFiles.find((f) => f.path === 'other/faq.html')
    expect(faq?.content).not.toContain('<hr')

    // 成功提示带配置来源（已决策：带一句，不打断流程）
    expect(mockAlertDialog).toHaveBeenCalledWith(expect.stringContaining('MkDocs config detected'))
  })

  it('mkdocs exclude_docs：页面与资产同滤（.gitignore 模式，相对 docs_dir）', async () => {
    setupInvoke({
      tree: [
        file('index.md', '/repo/docs'),
        file('secret.md', '/repo/docs'),
        dir('drafts', [file('notes.md', '/repo/docs/drafts')], '/repo/docs'),
        file('logo.png', '/repo/docs'),
        file('debug.log', '/repo/docs'),
      ],
      exists: { '/repo/mkdocs.yml': true, '/repo/docs': true },
      files: {
        '/repo/mkdocs.yml': `site_name: T
docs_dir: docs
exclude_docs: |
  /secret.md
  drafts/
  *.log
`,
        '/repo/docs/index.md': '# 首页\n',
      },
    })
    expect(await exportSite()).toBe(true)

    const paths = exportedFiles.map((f) => f.path)
    expect(paths).toEqual(expect.arrayContaining(['index.html', 'logo.png']))
    // 被排除的页面/资产不导出（secret.md 顶层锚定、drafts/ 目录、*.log 任意层级）
    expect(paths).not.toContain('secret.html')
    expect(paths).not.toContain('drafts/notes.html')
    expect(paths).not.toContain('debug.log')
  })

  it('vuepress 风味：docs/.vuepress → 范围收敛 docs/，提示带 VuePress 来源', async () => {
    setupInvoke({
      tree: [file('intro.md', '/repo/docs')],
      exists: { '/repo/docs/.vuepress': true },
      files: { '/repo/docs/intro.md': '# 介绍\n' },
    })
    expect(await exportSite()).toBe(true)
    expect(readDirPaths).toEqual(['/repo/docs'])
    expect(mockAlertDialog).toHaveBeenCalledWith(
      expect.stringContaining('VuePress project detected')
    )
  })
})
