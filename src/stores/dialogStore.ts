import { create } from 'zustand'

export type DialogKind = 'confirm' | 'alert'

export interface DialogRequest {
  kind: DialogKind
  message: string
  /** 自定义按钮文案（缺省走 dialog.confirm / dialog.cancel 通用文案） */
  confirmLabel?: string
  cancelLabel?: string
  /** ask() 挂起的 Promise 的 resolve；answer() 时调用 */
  resolve: (value: boolean) => void
}

interface DialogState {
  /** 当前打开的对话框；null = 无 */
  current: DialogRequest | null
  /** 打开对话框并挂起，直到 answer()；alert 的布尔值无意义（恒 true 关闭） */
  ask: (
    kind: DialogKind,
    message: string,
    labels?: { confirmLabel?: string; cancelLabel?: string }
  ) => Promise<boolean>
  /** 关闭并以 value resolve（Esc/overlay/取消 = false，确认/关闭 = true） */
  answer: (value: boolean) => void
}

/**
 * 自绘对话框状态（替代 Tauri WKWebView 中不可靠的原生 confirm/alert）
 * 薄封装见 src/lib/dialog.ts（confirmDialog/alertDialog）
 */
export const useDialogStore = create<DialogState>()((set, get) => ({
  current: null,

  ask: (kind, message, labels) => {
    // 已有对话框时先以取消值关闭，避免 Promise 挂起泄漏
    get().current?.resolve(false)
    return new Promise<boolean>((resolve) => {
      set({ current: { kind, message, ...labels, resolve } })
    })
  },

  answer: (value) => {
    const current = get().current
    if (!current) return
    set({ current: null })
    current.resolve(value)
  },
}))
