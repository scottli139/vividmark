import { invoke } from '@tauri-apps/api/core'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import i18n from '../i18n'
import { useEditorStore, type RecentFile } from '../stores/editorStore'
import type { ThemeMode } from './theme'
import { confirmDialog } from './dialog'
import { isTauri } from './imageSrc'
import { createLogger } from './logger'

const logger = createLogger('WindowManager')

/**
 * 多窗口（Typora 式 SDI）前端对接。
 *
 * 职责：
 * 1. 文档状态上报：filePath/isDirty → report_window_state（Rust 窗口注册表是
 *    「已打开文件 → 窗口」路由的事实来源；初始上报即建立本窗口条目）
 * 2. 关闭脏确认：onCloseRequested 拦截（多窗口后 Cmd+W/红灯高频；顺带补上单窗口遗留）
 * 3. 跨窗口偏好同步：themeMode/language/recentFiles 三字段经 tauri 事件广播
 *    （`prefs-sync`）同步到其他窗口——本窗口订阅变化后 emit，其他窗口 listener
 *    值比较后落地（相同跳过，防回声循环）。
 *    ⚠️ 不能用 localStorage 的 storage 事件：实测 macOS WKWebView 多窗口各自
 *    独立 localStorage（不共享），storage 事件跨窗口不触发。
 *    viewMode/zoom/sidebar 系窗口级状态，不同步（last-write-wins 仅影响下次启动默认值）。
 *
 * 菜单事件定向在 Rust 侧（window_router LAST_FOCUSED）；菜单 check/enabled 焦点
 * 跟随在 nativeMenu.ts（焦点门控）。
 */

const PREFS_SYNC_EVENT = 'prefs-sync'

/** 跨窗口同步的偏好载荷 */
interface PrefsSyncPayload {
  themeMode: ThemeMode
  language: string
  recentFiles: RecentFile[]
}

function applySyncedPrefs(payload: PrefsSyncPayload): void {
  const store = useEditorStore.getState()
  if (payload.themeMode && payload.themeMode !== store.themeMode) {
    store.setThemeMode(payload.themeMode)
  }
  if (payload.language && payload.language !== store.language) {
    store.setLanguage(payload.language as 'en' | 'zh-CN')
  }
  if (
    payload.recentFiles &&
    JSON.stringify(payload.recentFiles) !== JSON.stringify(store.recentFiles)
  ) {
    useEditorStore.setState({ recentFiles: payload.recentFiles })
  }
}

/** 初始化窗口管理（仅 Tauri 桌面端；返回 cleanup） */
export async function initWindowManager(): Promise<() => void> {
  if (!isTauri()) return () => {}
  const win = getCurrentWindow()

  // 1. 文档状态上报（初始 + 订阅变化）
  const report = () => {
    const { filePath, isDirty } = useEditorStore.getState()
    invoke('report_window_state', { path: filePath, dirty: isDirty }).catch((e) =>
      logger.warn('report_window_state failed:', e)
    )
  }
  report()
  const unsubscribeReport = useEditorStore.subscribe((state, prev) => {
    if (state.filePath !== prev.filePath || state.isDirty !== prev.isDirty) report()
  })

  // 2. 关闭脏确认（取消则阻止关闭）
  const unlistenClose = await win.onCloseRequested(async (event) => {
    if (!useEditorStore.getState().isDirty) return
    if (!(await confirmDialog(i18n.t('dialog.confirmDiscard') as string))) {
      event.preventDefault()
    }
  })

  // 3. 跨窗口偏好同步：本窗口三字段变化 → 广播；收到广播 → 值比较后落地
  const unlistenPrefs = await listen<PrefsSyncPayload>(PREFS_SYNC_EVENT, (event) => {
    applySyncedPrefs(event.payload)
  })
  const unsubscribePrefs = useEditorStore.subscribe((state, prev) => {
    if (
      state.themeMode !== prev.themeMode ||
      state.language !== prev.language ||
      state.recentFiles !== prev.recentFiles
    ) {
      emit(PREFS_SYNC_EVENT, {
        themeMode: state.themeMode,
        language: state.language,
        recentFiles: state.recentFiles,
      }).catch((e) => logger.warn('prefs sync emit failed:', e))
    }
  })

  logger.info('Window manager initialized')
  return () => {
    unsubscribeReport()
    unlistenClose()
    unlistenPrefs()
    unsubscribePrefs()
  }
}
