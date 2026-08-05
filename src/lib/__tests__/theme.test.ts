import { describe, it, expect, vi } from 'vitest'
import { resolveTheme, getSystemDark } from '../theme'

function mockSystemDark(matches: boolean) {
  vi.mocked(window.matchMedia).mockReturnValue({ matches } as unknown as MediaQueryList)
}

describe('resolveTheme', () => {
  it('light 模式始终为亮色', () => {
    expect(resolveTheme('light', true)).toBe(false)
    expect(resolveTheme('light', false)).toBe(false)
  })

  it('dark 模式始终为暗色', () => {
    expect(resolveTheme('dark', true)).toBe(true)
    expect(resolveTheme('dark', false)).toBe(true)
  })

  it('system 模式跟随系统偏好', () => {
    expect(resolveTheme('system', true)).toBe(true)
    expect(resolveTheme('system', false)).toBe(false)
  })
})

describe('getSystemDark', () => {
  it('跟随 matchMedia 结果', () => {
    mockSystemDark(false)
    expect(getSystemDark()).toBe(false)

    mockSystemDark(true)
    expect(getSystemDark()).toBe(true)
  })

  it('无 window 环境安全返回 false', () => {
    vi.stubGlobal('window', undefined)
    expect(getSystemDark()).toBe(false)
    vi.unstubAllGlobals()
  })
})
