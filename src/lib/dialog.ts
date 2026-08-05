import { useDialogStore } from '../stores/dialogStore'

/**
 * 自绘确认弹窗（替代原生 window.confirm，Tauri WKWebView 中不可靠）
 * 用法与原生一致：if (!(await confirmDialog(msg))) return
 */
export function confirmDialog(message: string): Promise<boolean> {
  return useDialogStore.getState().ask('confirm', message)
}

/** 自绘提示弹窗（替代原生 window.alert） */
export async function alertDialog(message: string): Promise<void> {
  await useDialogStore.getState().ask('alert', message)
}
