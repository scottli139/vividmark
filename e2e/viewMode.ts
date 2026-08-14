import type { Page } from '@playwright/test'

export type ViewModeLabel = 'WYSIWYG' | 'Source' | 'Split' | 'Preview'

/**
 * 经状态栏右侧的视图模式下拉切换模式（极简工具栏已无切换组）。
 * mode 为英文界面文案（e2e 默认 en locale）。
 */
export async function setViewMode(page: Page, mode: ViewModeLabel): Promise<void> {
  await page.getByTestId('statusbar-viewmode').click()
  await page.getByRole('menuitemcheckbox', { name: mode }).click()
}
