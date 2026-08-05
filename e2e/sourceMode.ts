import type { Page } from '@playwright/test'

/**
 * 预置 localStorage，让 zustand persist（key: vividmark-storage）以 source 模式 rehydrate。
 *
 * 默认视图模式已是 wysiwyg；依赖 CodeMirror（.cm-editor/.cm-content）的 spec
 * 在 beforeEach 中、page.goto() 之前调用本函数。
 * 存储格式：{ state: <partialize 后的状态>, version: 0 }。
 */
export async function presetSourceMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'vividmark-storage',
      JSON.stringify({ state: { viewMode: 'source' }, version: 0 })
    )
  })
}
