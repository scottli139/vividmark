import { isTauri } from './imageSrc'

/**
 * 平台探测 — 目前仅用于 macOS 融合标题栏（traffic light 避让）判断
 */

// 是否为 macOS（UA 探测，浏览器/dev 环境同样可用）
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac/i.test(navigator.platform) || /macintosh/i.test(navigator.userAgent)
}

// 是否为「macOS 上的 Tauri 桌面窗口」——融合标题栏样式只在此场景生效
export function isMacOSDesktop(): boolean {
  return isTauri() && isMacOS()
}
