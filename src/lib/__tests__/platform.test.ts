import { describe, it, expect, afterEach } from 'vitest'
import { isLinux, isLinuxDesktop, isMacOS } from '../platform'

// setup.ts 把 navigator.platform mock 为 MacIntel（writable）；这里按需覆盖并恢复
const originalPlatform = navigator.platform
const originalUserAgent = navigator.userAgent

function mockNavigator(platform: string, userAgent: string) {
  Object.defineProperty(navigator, 'platform', { value: platform, writable: true })
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, writable: true })
}

function mockTauriRuntime(on: boolean) {
  const w = window as unknown as Record<string, unknown>
  if (on) w.__TAURI_INTERNALS__ = {}
  else delete w.__TAURI_INTERNALS__
}

afterEach(() => {
  mockNavigator(originalPlatform, originalUserAgent)
  mockTauriRuntime(false)
})

describe('platform', () => {
  describe('isLinux', () => {
    it('returns true for Linux desktop UA', () => {
      mockNavigator(
        'Linux x86_64',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)'
      )
      expect(isLinux()).toBe(true)
    })

    it('returns true when only userAgent contains Linux', () => {
      mockNavigator('', 'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/605.1.15')
      expect(isLinux()).toBe(true)
    })

    it('returns false for Android (mobile excluded)', () => {
      mockNavigator('Linux aarch64', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36')
      expect(isLinux()).toBe(false)
    })

    it('returns false for macOS', () => {
      mockNavigator('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
      expect(isLinux()).toBe(false)
      expect(isMacOS()).toBe(true)
    })
  })

  describe('isLinuxDesktop', () => {
    it('returns true only on Linux inside Tauri runtime', () => {
      mockNavigator('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)')
      mockTauriRuntime(true)
      expect(isLinuxDesktop()).toBe(true)
    })

    it('returns false on Linux in plain browser', () => {
      mockNavigator('Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)')
      mockTauriRuntime(false)
      expect(isLinuxDesktop()).toBe(false)
    })

    it('returns false on macOS even inside Tauri runtime', () => {
      mockNavigator('MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
      mockTauriRuntime(true)
      expect(isLinuxDesktop()).toBe(false)
    })
  })
})
