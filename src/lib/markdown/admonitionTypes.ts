/**
 * Admonition（提示框）类型定义 — preview 渲染（markdown-it）与 WYSIWYG 编辑器（Milkdown）共用
 */

export const admonitionTypes = [
  'tip',
  'warning',
  'info',
  'note',
  'danger',
  'success',
  'hint',
  'important',
  'caution',
] as const

export type AdmonitionType = (typeof admonitionTypes)[number]

export function isAdmonitionType(value: string): value is AdmonitionType {
  return (admonitionTypes as readonly string[]).includes(value)
}

/**
 * 标题显示规则：自定义标题优先，否则用类型名首字母大写
 * （与 markdown-it-container 的 render 规则一致，见 parser.ts）
 */
export function getAdmonitionDisplayTitle(type: string, title: string): string {
  return title || type.charAt(0).toUpperCase() + type.slice(1)
}
