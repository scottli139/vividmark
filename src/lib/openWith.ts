import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import i18n from '../i18n'
import { useEditorStore } from '../stores/editorStore'
import { confirmDialog } from './dialog'
import { openFileByPath } from './fileOps'
import { isTauri } from './imageSrc'
import { createLogger } from './logger'

const logger = createLogger('OpenWith')

/**
 * 文件关联「打开方式」/ 双击 .md 打开（macOS RunEvent::Opened → 窗口路由 file-open-request）。
 *
 * 冷启动竞态：Opened 事件可能早于前端监听器注册，Rust 侧按窗口 label 入启动队列；
 * 前端注册监听后调用 take_startup_open_files 取走本窗口积压路径。
 * 热打开（app 运行中）由 Rust window_router 定向到目标窗口（已打开→聚焦/
 * 干净空窗口→复用/否则新建窗口），收到事件即本窗口应打开。
 */
async function openPaths(paths: string[]): Promise<void> {
  for (const path of paths) {
    const store = useEditorStore.getState()
    // 与最近文件打开一致：脏文档先确认
    if (store.isDirty) {
      if (!(await confirmDialog(i18n.t('dialog.confirmDiscard') as string))) continue
    }
    await openFileByPath(path)
  }
}

/** 初始化文件关联打开（仅 Tauri 桌面端；返回 cleanup） */
export async function initOpenWith(): Promise<() => void> {
  if (!isTauri()) return () => {}

  let unlisten: UnlistenFn | undefined
  try {
    unlisten = await listen<string[]>('file-open-request', (event) => {
      // HMR/全量重载时清空所有 label 的待打开队列（本窗口自己的已取走；其余
      // label 的所属页面已失效，遗留的陈旧条目若被重载后的页面再次取走会
      // 重开文件——多窗口下这是菜单重建风暴的燃料之一）
      void invoke('take_startup_open_files', { label: null })
      // Rust 侧已按窗口定向（window_router），收到即本窗口应打开
      openPaths(event.payload).catch((e) => logger.error('Open-with failed:', e))
    })
  } catch (e) {
    logger.error('Failed to listen file-open-request:', e)
    return () => {}
  }

  // 冷启动/新窗口启动积压路径（按本窗口 label 取走）
  const pending = await invoke<string[]>('take_startup_open_files').catch(() => [])
  if (pending.length > 0) {
    await openPaths(pending)
  }

  logger.info('Open-with listener initialized')
  return () => unlisten?.()
}
