import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import i18n from '../i18n'
import { useEditorStore } from '../stores/editorStore'
import { useDialogStore } from '../stores/dialogStore'
import { isTauri } from './imageSrc'
import { createLogger } from './logger'

const logger = createLogger('FileWatcher')

/**
 * 文件变更监控（外部修改自动重载）
 *
 * Rust 侧 file_watch.rs 按窗口监听当前文档（父目录过滤 + 300ms 防抖），
 * 事件经 `file-watch-event` 定向推回本窗口；本模块负责决策与执行：
 *
 * - 磁盘内容 == lastKnownContent → 自己保存的回声，忽略
 * - 外部修改 + 缓冲区干净 → 静默重载（对齐 VS Code / Typora）
 * - 外部修改 + 有未保存更改 → 冲突弹窗「重新加载 / 保留我的更改」，
 *   未决期间 useAutoSave 暂停（防 2s 定时器静默覆盖外部版本）
 * - 外部删除/移动 → 提示一次；内容保留，下次保存重建文件
 *
 * lastKnownContent 是回声抑制的唯一机制，在 open / save 成功 / reload /
 * 冲突选「保留」四个时机更新（fileOps.ts 埋点 markFileContentKnown）。
 */

interface FileWatchPayload {
  path: string
  kind: 'changed' | 'removed'
}

interface FileInfo {
  path: string
  content: string
  name: string
}

export type WatchAction = 'ignore' | 'reload' | 'conflict' | 'deleted'

/** 事件 → 动作 纯决策（单测主体） */
export function decideWatchAction(input: {
  kind: 'changed' | 'removed'
  diskContent: string | null
  lastKnown: string | null
  isDirty: boolean
  conflictPending: boolean
  removedNotified: boolean
}): WatchAction {
  if (input.conflictPending) return 'ignore'
  if (input.kind === 'removed') return input.removedNotified ? 'ignore' : 'deleted'
  if (input.diskContent === input.lastKnown) return 'ignore'
  return input.isDirty ? 'conflict' : 'reload'
}

// ---------- 模块级簿记（单文档窗口，无需按路径分桶） ----------

let lastKnownContent: string | null = null
let conflictPending = false
let removedNotified = false

/** 冲突弹窗未决期间自动保存必须暂停（防静默覆盖外部版本） */
export function isWatchConflictPending(): boolean {
  return conflictPending
}

/** fileOps 埋点：open / save 成功后登记「我最后读过或写过的磁盘内容」 */
export function markFileContentKnown(content: string): void {
  lastKnownContent = content
  // 保存成功即重建/覆盖了文件，删除提示状态随之失效
  removedNotified = false
}

/** 测试用：重置模块簿记 */
export function resetFileWatcherState(): void {
  lastKnownContent = null
  conflictPending = false
  removedNotified = false
}

function t(key: string): string {
  return i18n.t(key) as string
}

/** 重载磁盘内容进编辑器（复用打开文件的 store → 编辑器同步链） */
function applyReload(content: string): void {
  const store = useEditorStore.getState()
  store.setContent(content)
  store.setDirty(false)
  lastKnownContent = content
  removedNotified = false
  logger.info('Reloaded external changes')
}

async function readDisk(path: string): Promise<string | null> {
  try {
    const info = await invoke<FileInfo>('read_file', { path })
    return info.content
  } catch (error) {
    logger.warn('read_file failed on watch event:', error)
    return null
  }
}

async function handleWatchEvent(payload: FileWatchPayload): Promise<void> {
  const store = useEditorStore.getState()
  // 定向 emit 理论只到本窗口，仍按当前文档校验一次
  if (payload.path !== store.filePath) return
  // 冲突弹窗未决：后续事件直接忽略（解决路径会重读磁盘），避免重复读盘/叠弹窗
  if (conflictPending) return

  // changed 先读一次盘供决策与重载共用；读失败（权限/竞态删除）按兵不动
  const disk = payload.kind === 'changed' ? await readDisk(payload.path) : null
  if (payload.kind === 'changed' && disk === null) return

  const action = decideWatchAction({
    kind: payload.kind,
    diskContent: disk,
    lastKnown: lastKnownContent,
    isDirty: store.isDirty,
    conflictPending,
    removedNotified,
  })

  switch (action) {
    case 'ignore':
      return
    case 'deleted':
      removedNotified = true
      await useDialogStore.getState().ask('alert', t('dialog.fileDeletedExternal'))
      return
    case 'reload':
      applyReload(disk!)
      return
    case 'conflict': {
      conflictPending = true
      try {
        const reload = await useDialogStore
          .getState()
          .ask('confirm', t('dialog.externalChangeConflict'), {
            confirmLabel: t('dialog.reload'),
            cancelLabel: t('dialog.keepMine'),
          })
        if (reload) {
          // 弹窗期间磁盘可能又变，重读最新版（失败回退事件时刻读到的内容）
          const fresh = await readDisk(payload.path)
          applyReload(fresh ?? disk!)
        } else {
          // 保留我的版本：磁盘现状记为已知，下次保存覆盖之
          lastKnownContent = disk
        }
      } finally {
        conflictPending = false
      }
    }
  }
}

/**
 * 初始化文件变更监控（仅 Tauri 桌面端；返回 cleanup）
 * 跟随 store.filePath 切换 watcher；生命周期同窗口 webview。
 */
export async function initFileWatcher(): Promise<() => void> {
  if (!isTauri()) return () => {}

  const syncWatch = (path: string | null) => {
    const cmd = path ? invoke('watch_file', { path }) : invoke('unwatch_file')
    cmd.catch((e) => logger.warn('sync watcher failed:', e))
  }

  syncWatch(useEditorStore.getState().filePath)
  const unsubscribe = useEditorStore.subscribe((state, prev) => {
    if (state.filePath === prev.filePath) return
    // 换文档清空簿记；openFileByPath 随后会 markFileContentKnown 填新值
    lastKnownContent = null
    removedNotified = false
    syncWatch(state.filePath)
  })

  const unlisten: UnlistenFn = await listen<FileWatchPayload>('file-watch-event', (event) => {
    void handleWatchEvent(event.payload)
  })

  logger.info('File watcher initialized')
  return () => {
    unsubscribe()
    unlisten()
  }
}
