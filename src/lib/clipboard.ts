import {
  readText as tauriReadText,
  writeText as tauriWriteText,
} from '@tauri-apps/plugin-clipboard-manager'
import { isTauri } from './imageSrc'
import { createLogger } from './logger'

const logger = createLogger('Clipboard')

/**
 * 剪贴板读写封装：桌面端走 tauri-plugin-clipboard-manager（WKWebView 下
 * navigator.clipboard.readText 不可用），浏览器 dev/E2E 降级 navigator.clipboard。
 * 失败时返回 null / false 并记日志，调用方无需 try/catch。
 */
export async function readClipboardText(): Promise<string | null> {
  try {
    if (isTauri()) {
      return await tauriReadText()
    }
    return await navigator.clipboard.readText()
  } catch (error) {
    logger.warn('Failed to read clipboard:', error)
    return null
  }
}

export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (isTauri()) {
      await tauriWriteText(text)
    } else {
      await navigator.clipboard.writeText(text)
    }
    return true
  } catch (error) {
    logger.warn('Failed to write clipboard:', error)
    return false
  }
}
