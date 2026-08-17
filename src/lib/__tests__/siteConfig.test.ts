import { describe, it, expect } from 'vitest'
import {
  compileExcludePatterns,
  detectSiteFlavor,
  frontmatterTitle,
  isExcludedPath,
  parseFrontmatter,
  parseMkdocsConfig,
  type FlavorIo,
} from '../siteConfig'

// ==================== parseMkdocsConfig ====================

describe('parseMkdocsConfig', () => {
  it('提取 site_name / docs_dir / nav（嵌套分组、外链、引号标题、./ 前缀剥离）', () => {
    const config = parseMkdocsConfig(`site_name: 中创视讯
docs_dir: ./docs
nav:
  - 首页: svcsdk/README.md
  - 会捷通 SDK (SVC):
    - Windows 版本 (C++): svcsdk/windows-cpp.md
    - macOS 版本: svcsdk/macos-sdk.md
  - "含冒号: 的标题": other/faq.md
  - 公司主页: http://www.hexmeet.com
`)
    expect(config.siteName).toBe('中创视讯')
    expect(config.docsDir).toBe('docs')
    expect(config.nav).toEqual([
      { title: '首页', path: 'svcsdk/README.md' },
      {
        title: '会捷通 SDK (SVC)',
        children: [
          { title: 'Windows 版本 (C++)', path: 'svcsdk/windows-cpp.md' },
          { title: 'macOS 版本', path: 'svcsdk/macos-sdk.md' },
        ],
      },
      { title: '含冒号: 的标题', path: 'other/faq.md' },
      { title: '公司主页', url: 'http://www.hexmeet.com' },
    ])
  })

  it('缺省 docs_dir 为 docs；无 nav 时 nav 字段缺省', () => {
    const config = parseMkdocsConfig('site_name: X\n')
    expect(config.docsDir).toBe('docs')
    expect(config.nav).toBeUndefined()
  })

  it('docs_dir 为 ./ 或 . 时归一为打开目录本身', () => {
    expect(parseMkdocsConfig('docs_dir: ./\n').docsDir).toBe('')
    expect(parseMkdocsConfig('docs_dir: .\n').docsDir).toBe('')
  })

  it('外链判定：scheme / // / 根绝对路径', () => {
    const config = parseMkdocsConfig(`nav:
  - a: https://a.com
  - b: //cdn.com/x
  - c: /legal/
  - d: page.md
`)
    expect(config.nav?.[0].url).toBe('https://a.com')
    expect(config.nav?.[1].url).toBe('//cdn.com/x')
    expect(config.nav?.[2].url).toBe('/legal/')
    expect(config.nav?.[3].path).toBe('page.md')
  })

  it('非法条目（多键 map / 非字符串非数组值）跳过', () => {
    const config = parseMkdocsConfig(`nav:
  - 有效: a.md
  - 42
  - {a: 1, b: 2}
  - 空:
`)
    expect(config.nav).toEqual([{ title: '有效', path: 'a.md' }])
  })

  it('YAML 语法错误抛异常（由调用方降级）', () => {
    expect(() => parseMkdocsConfig('nav: [unclosed')).toThrow()
  })

  it('非 map 文档返回空配置', () => {
    expect(parseMkdocsConfig('- just\n- a\n- list\n')).toEqual({})
  })
})

// ==================== parseFrontmatter / frontmatterTitle ====================

describe('parseFrontmatter', () => {
  it('解析并剥离 frontmatter，提取 title', () => {
    const { data, body } = parseFrontmatter('---\ntitle: 指南\ndraft: false\n---\n# 正文标题\n')
    expect(frontmatterTitle(data)).toBe('指南')
    expect(data?.draft).toBe(false)
    expect(body).toBe('# 正文标题\n')
  })

  it('无闭合围栏 → 按无 frontmatter 处理（原文返回）', () => {
    const content = '---\ntitle: x\n\n# 正文\n'
    const { data, body } = parseFrontmatter(content)
    expect(data).toBeNull()
    expect(body).toBe(content)
  })

  it('非文档开头（前面有内容/空行）不算 frontmatter', () => {
    const content = '# 标题\n\n---\ntitle: x\n---\n'
    expect(parseFrontmatter(content).data).toBeNull()
    expect(parseFrontmatter(content).body).toBe(content)
  })

  it('YAML 解析失败 → 保守返回原文（不剥离）', () => {
    const content = '---\n: [broken\n---\n正文\n'
    const { data, body } = parseFrontmatter(content)
    expect(data).toBeNull()
    expect(body).toBe(content)
  })

  it('CRLF 行尾可解析', () => {
    const { data, body } = parseFrontmatter('---\r\ntitle: x\r\n---\r\n正文\r\n')
    expect(frontmatterTitle(data)).toBe('x')
    expect(body).toBe('正文\r\n')
  })

  it('frontmatterTitle：非字符串/空白/缺字段返回 null', () => {
    expect(frontmatterTitle(null)).toBeNull()
    expect(frontmatterTitle({})).toBeNull()
    expect(frontmatterTitle({ title: 42 })).toBeNull()
    expect(frontmatterTitle({ title: '   ' })).toBeNull()
  })
})

// ==================== detectSiteFlavor ====================

/** 假 IO：files 键值 = 文件内容；dirs 集合 = 存在的目录 */
function fakeIo(files: Record<string, string>, dirs: string[] = []): FlavorIo {
  const dirSet = new Set(dirs)
  return {
    fileExists: async (path) => path in files || dirSet.has(path),
    readTextFile: async (path) => {
      const content = files[path]
      if (content === undefined) throw new Error(`not a file: ${path}`)
      return content
    },
  }
}

describe('detectSiteFlavor', () => {
  it('无任何配置 → plain', async () => {
    const info = await detectSiteFlavor('/repo', fakeIo({ '/repo/a.md': '# a' }))
    expect(info).toEqual({ flavor: 'plain', docsRoot: '' })
  })

  it('打开目录根 mkdocs.yml + docs_dir 存在 → mkdocs，范围收敛 docs/', async () => {
    const info = await detectSiteFlavor(
      '/repo',
      fakeIo({ '/repo/mkdocs.yml': 'site_name: 中创视讯\ndocs_dir: ./docs\n' }, ['/repo/docs'])
    )
    expect(info.flavor).toBe('mkdocs')
    expect(info.docsRoot).toBe('docs')
    expect(info.mkdocsConfig?.siteName).toBe('中创视讯')
    expect(info.mkdocsConfigPath).toBe('/repo/mkdocs.yml')
  })

  it("docs_dir 不存在 → docsRoot 退回 '' 并带 warning", async () => {
    const info = await detectSiteFlavor('/repo', fakeIo({ '/repo/mkdocs.yml': 'site_name: X\n' }))
    expect(info.flavor).toBe('mkdocs')
    expect(info.docsRoot).toBe('')
    expect(info.warning).toContain('docs')
  })

  it('双配置共存 → mkdocs 优先（确定性规则）', async () => {
    const info = await detectSiteFlavor(
      '/repo',
      fakeIo({ '/repo/mkdocs.yml': 'site_name: X\n' }, ['/repo/docs', '/repo/docs/.vuepress'])
    )
    expect(info.flavor).toBe('mkdocs')
  })

  it('向上一级命中：父目录 mkdocs.yml 的 docs_dir 指回打开目录', async () => {
    const info = await detectSiteFlavor(
      '/repo/docs',
      fakeIo({ '/repo/mkdocs.yml': 'site_name: X\ndocs_dir: ./docs\n' })
    )
    expect(info.flavor).toBe('mkdocs')
    expect(info.docsRoot).toBe('')
    expect(info.mkdocsConfigPath).toBe('/repo/mkdocs.yml')
  })

  it('向上一级不命中：docs_dir 指向别处 → plain', async () => {
    const info = await detectSiteFlavor(
      '/repo/documentation',
      fakeIo({ '/repo/mkdocs.yml': 'docs_dir: docs\n' })
    )
    expect(info.flavor).toBe('plain')
  })

  it('配置解析失败 → plain + warning（优雅降级，不阻断导出）', async () => {
    const info = await detectSiteFlavor('/repo', fakeIo({ '/repo/mkdocs.yml': 'nav: [unclosed' }))
    expect(info.flavor).toBe('plain')
    expect(info.warning).toBeTruthy()
  })

  it("vuepress：打开目录根 .vuepress → docsRoot ''", async () => {
    const info = await detectSiteFlavor('/repo', fakeIo({}, ['/repo/.vuepress']))
    expect(info).toEqual({ flavor: 'vuepress', docsRoot: '' })
  })

  it("vuepress：docs/.vuepress → docsRoot 'docs'", async () => {
    const info = await detectSiteFlavor('/repo', fakeIo({}, ['/repo/docs/.vuepress']))
    expect(info).toEqual({ flavor: 'vuepress', docsRoot: 'docs' })
  })
})

// ==================== exclude_docs（.gitignore 模式） ====================

describe('parseMkdocsConfig exclude_docs', () => {
  it('多行字符串形式（官方格式）：剥注释与空行，保留 ! 取反与 / 锚定', () => {
    const config = parseMkdocsConfig(`site_name: T
exclude_docs: |
  api-config.json    # A file with this name anywhere.
  /requirements.txt  # Top-level file.

  *.py
  !/foo/example.py   # But keep this particular file.
`)
    expect(config.excludeDocs).toEqual([
      'api-config.json',
      '/requirements.txt',
      '*.py',
      '!/foo/example.py',
    ])
  })

  it('YAML 数组形式兼容', () => {
    const config = parseMkdocsConfig(`exclude_docs:
  - drafts/*
  - /secret.md
`)
    expect(config.excludeDocs).toEqual(['drafts/*', '/secret.md'])
  })

  it('缺省为 undefined', () => {
    expect(parseMkdocsConfig('site_name: T').excludeDocs).toBeUndefined()
  })
})

describe('exclude_docs 匹配（.gitignore 语义）', () => {
  it('无 / 模式匹配任意层级文件名', () => {
    const patterns = compileExcludePatterns(['api-config.json'])
    expect(isExcludedPath(patterns, 'api-config.json')).toBe(true)
    expect(isExcludedPath(patterns, 'sub/api-config.json')).toBe(true)
    expect(isExcludedPath(patterns, 'other.md')).toBe(false)
  })

  it('前导 / 锚定 docs_dir 根', () => {
    const patterns = compileExcludePatterns(['/requirements.txt'])
    expect(isExcludedPath(patterns, 'requirements.txt')).toBe(true)
    expect(isExcludedPath(patterns, 'sub/requirements.txt')).toBe(false)
  })

  it('* 不跨目录；*.py 任意层级', () => {
    const patterns = compileExcludePatterns(['*.py'])
    expect(isExcludedPath(patterns, 'a.py')).toBe(true)
    expect(isExcludedPath(patterns, 'sub/a.py')).toBe(true)
    expect(isExcludedPath(patterns, 'a.py.md')).toBe(false)
  })

  it('含 / 模式锚定根：docs/*.md 不匹配嵌套与子目录同名', () => {
    const patterns = compileExcludePatterns(['docs/*.md'])
    expect(isExcludedPath(patterns, 'docs/a.md')).toBe(true)
    expect(isExcludedPath(patterns, 'docs/a/b.md')).toBe(false)
    expect(isExcludedPath(patterns, 'sub/docs/a.md')).toBe(false)
  })

  it('尾部 / 仅目录：其下文件全部排除', () => {
    const patterns = compileExcludePatterns(['drafts/'])
    expect(isExcludedPath(patterns, 'drafts/a.md')).toBe(true)
    expect(isExcludedPath(patterns, 'x/drafts/b.md')).toBe(true)
    expect(isExcludedPath(patterns, 'drafts.md')).toBe(false)
  })

  it('! 取反：最后命中者决定（重新纳入个别文件）', () => {
    const patterns = compileExcludePatterns(['*.py', '!/foo/example.py'])
    expect(isExcludedPath(patterns, 'foo/example.py')).toBe(false)
    expect(isExcludedPath(patterns, 'foo/other.py')).toBe(true)
    expect(isExcludedPath(patterns, 'bar/example.py')).toBe(true)
  })

  it('**/ 前缀匹配任意层级（含零层）', () => {
    const patterns = compileExcludePatterns(['**/draft.md'])
    expect(isExcludedPath(patterns, 'draft.md')).toBe(true)
    expect(isExcludedPath(patterns, 'a/b/draft.md')).toBe(true)
  })

  it('结尾 /** 匹配目录内一切', () => {
    const patterns = compileExcludePatterns(['vendor/**'])
    expect(isExcludedPath(patterns, 'vendor/a/b.txt')).toBe(true)
    expect(isExcludedPath(patterns, 'x/vendor/a.txt')).toBe(false)
  })
})
