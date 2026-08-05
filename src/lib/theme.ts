export type ThemeMode = 'light' | 'dark' | 'system'

/** 根据主题模式与系统偏好解析最终是否为暗色 */
export function resolveTheme(mode: ThemeMode, systemDark: boolean): boolean {
  if (mode === 'system') return systemDark
  return mode === 'dark'
}

/** 探测系统是否为暗色模式（SSR / 无 window 环境安全返回 false） */
export function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
