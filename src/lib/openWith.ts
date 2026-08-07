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
 * 文件关联「打开方式」/ 双击 .md 打开（macOS RunEvent::Opened → file-open-request）。
 *
 * 冷启动竞态：Opened 事件可能早于前端监听器注册，Rust 侧同时入队；
 * 前端注册监听后调用 take_pending_open_files 取走积压路径。
 * 热打开（app 运行中）直接走事件 payload，并顺手清空队列防陈旧路径重开。
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
      // 保持队列为空：HMR/重初始化时 take_pending 不会拿到陈旧路径
      void invoke('take_pending_open_files')
      openPaths(event.payload).catch((e) => logger.error('Open-with failed:', e))
    })
  } catch (e) {
    logger.error('Failed to listen file-open-request:', e)
    return () => {}
  }

  // 冷启动积压路径
  const pending = await invoke<string[]>('take_pending_open_files').catch(() => [])
  if (pending.length > 0) {
    await openPaths(pending)
  }

  logger.info('Open-with listener initialized')
  return () => unlisten?.()
}
