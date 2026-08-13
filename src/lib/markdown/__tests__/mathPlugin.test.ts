import { describe, it, expect, vi } from 'vitest'
import { parseMarkdown } from '../parser'

// Mock Tauri API（parser.ts 顶层依赖）
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost${path}`),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
}))

/**
 * 数学公式（KaTeX）markdown-it 侧渲染测试
 *
 * 语法行为与 micromark-extension-math 3.x（WYSIWYG 侧 remark-math）对齐：
 * - 块级仅多行围栏；单行 `$$x$$` 是行内公式（fence meta 含 $ 降级）
 * - mathText 无 pandoc 货币保护（`$5 and $10` 会被解析）——行为锁定测试
 */
describe('mathPlugin (markdown-it)', () => {
  describe('inline math', () => {
    it('should render inline math with $...$', () => {
      const result = parseMarkdown('质能方程 $e=mc^2$ 著名')
      expect(result).toContain('class="math-inline"')
      expect(result).toContain('class="katex"')
    })

    it('should render multiple inline math in one line', () => {
      const result = parseMarkdown('$a$ 和 $b$ 两个公式')
      expect(result.match(/class="math-inline"/g)).toHaveLength(2)
    })

    it('should render single-line $$x$$ as inline math (micromark compat)', () => {
      const result = parseMarkdown('$$x+y$$')
      expect(result).toContain('class="math-inline"')
      expect(result).not.toContain('katex-display')
    })

    it('should keep content with spaces around ($ x $ padding)', () => {
      const result = parseMarkdown('$ x $')
      expect(result).toContain('class="math-inline"')
    })

    it('should NOT parse escaped \\$ as math', () => {
      const result = parseMarkdown('价格是 \\$100 美元')
      expect(result).not.toContain('math-inline')
      expect(result).toContain('$100')
    })

    it('should NOT parse unmatched single $', () => {
      const result = parseMarkdown('价格 $100 没有闭合')
      expect(result).not.toContain('math-inline')
    })

    it('should parse $5 and $10 as math (micromark has no digit guard)', () => {
      // 行为锁定：micromark mathText 无 pandoc 货币保护，双端保持一致
      const result = parseMarkdown('$5 and $10')
      expect(result).toContain('class="math-inline"')
    })

    it('should not throw on invalid formula (throwOnError: false)', () => {
      expect(() => parseMarkdown('$\\invalid{$')).not.toThrow()
      expect(parseMarkdown('$\\invalid{$')).toContain('katex-error')
    })
  })

  describe('block math', () => {
    it('should render multi-line $$ fence as display math', () => {
      const result = parseMarkdown('$$\n\\frac{1}{2}\n$$')
      expect(result).toContain('class="math-block"')
      expect(result).toContain('katex-display')
    })

    it('should render empty-fence content until EOF without closing fence', () => {
      const result = parseMarkdown('$$\nx+y')
      expect(result).toContain('class="math-block"')
    })

    it('should not consume following paragraph after closing fence', () => {
      const result = parseMarkdown('$$\nx\n$$\n\n后续段落')
      expect(result).toContain('class="math-block"')
      expect(result).toContain('后续段落')
      expect(result.indexOf('math-block')).toBeLessThan(result.indexOf('后续段落'))
    })

    it('should not throw on invalid block formula', () => {
      expect(() => parseMarkdown('$$\n\\invalid{\n$$')).not.toThrow()
    })
  })

  describe('coexistence with other syntax', () => {
    it('should NOT parse math inside fenced code block', () => {
      const result = parseMarkdown('```\n$x$\n```')
      expect(result).not.toContain('math-inline')
      // hljs 高亮会把内容包进 span，断言保留在代码块内即可
      expect(result).toContain('<pre class="hljs">')
    })

    it('should NOT parse math inside inline code', () => {
      const result = parseMarkdown('`$x$` 是代码')
      expect(result).not.toContain('math-inline')
    })

    it('should render math inside admonition', () => {
      const result = parseMarkdown('::: tip\n公式 $e=mc^2$\n:::')
      expect(result).toContain('admonition tip')
      expect(result).toContain('class="math-inline"')
    })

    it('should render math inside list item', () => {
      const result = parseMarkdown('- 勾股定理 $a^2+b^2=c^2$')
      expect(result).toContain('class="math-inline"')
      expect(result).toContain('<li')
    })

    it('should render math alongside bold text', () => {
      const result = parseMarkdown('**重要**：$e=mc^2$')
      expect(result).toContain('<strong>')
      expect(result).toContain('class="math-inline"')
    })
  })
})
