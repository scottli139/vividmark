/// <reference types="node" />

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rules = [
  { label: '硬编码十六进制颜色', pattern: /#[\da-fA-F]{3,8}\b/ },
  {
    label: '硬编码 Tailwind 中性色板',
    pattern: /(?:bg|text|border|ring|outline)-(?:gray|slate|zinc|neutral|stone)-\d+/,
  },
  { label: '静态内联 fontSize', pattern: /fontSize\s*:\s*['"]/ },
  { label: '内联 fontFamily', pattern: /fontFamily\s*:\s*['"]/ },
]

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : componentFiles(path)
    }
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

describe('设计系统守卫', () => {
  it('组件不使用绕过 Token 的硬编码视觉样式', () => {
    const violations = componentFiles(resolve(process.cwd(), 'src/components')).flatMap((path) => {
      const lines = readFileSync(path, 'utf8').split('\n')
      return lines.flatMap((line, index) => {
        if (line.trimStart().startsWith('//')) return []
        return rules
          .filter((rule) => rule.pattern.test(line))
          .map((rule) => `${path}:${index + 1} ${rule.label}：${line.trim()}`)
      })
    })

    expect(violations).toEqual([])
  })
})
