import { isTauri } from './imageSrc'

/**
 * 平台探测 — macOS 用于融合标题栏（traffic light 避让）；Linux 用于无边框
 * 自绘标题栏（窗口控制按钮 / 边缘缩放手柄，窗口 decorations 在 Rust 侧关闭）
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

// 是否为 Linux 桌面（UA 探测；Android 排除——本项目只做桌面端）
export function isLinux(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/android/i.test(navigator.userAgent)) return false
  return /linux/i.test(navigator.platform) || /linux/i.test(navigator.userAgent)
}

// 是否为「Linux 上的 Tauri 桌面窗口」——无边框自绘标题栏只在此场景生效
export function isLinuxDesktop(): boolean {
  return isTauri() && isLinux()
}
