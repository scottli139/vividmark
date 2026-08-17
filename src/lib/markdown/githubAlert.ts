/**
 * GitHub Alerts（`> [!NOTE]`）双端支持的共享纯函数（方案：docs/syntax-extensions-plan.md 批次 1）。
 *
 * 语法形态：blockquote 首段首行 `[!TYPE]` 独占一行（允许尾部空白，大小写不敏感），
 * 类型限定 GitHub 五类（note/tip/important/warning/caution，与 admonitionTypes 一一对应）。
 *
 * 双端消费方：
 * 1. 预览/分栏/导出（githubAlertPlugin.ts）：markdown-it core rule 后处理 blockquote
 *    token，命中后改写为 `<div class="admonition">` 三段式（复用现有 CSS），标记行剥离。
 * 2. WYSIWYG（Editor/githubAlertDecorations.ts）：ProseMirror Decoration 给命中的
 *    blockquote 注入 `admonition <type> github-alert` class 上色加图标；标记行作为
 *    普通文本保留可见可编辑——零 schema 变更，天然无损往返。
 *
 * 设计决策（对齐 GitHub 行为，Obsidian 差异处从严）：
 * - 五类之外的类型（含 Obsidian 扩展类型 abstract/question/...）不识别 → 普通引用块，
 *   优雅降级不丢内容（GitHub 对未知类型同样只渲染普通引用）。
 * - 标记后同行跟文本不识别（GitHub 不支持行内标题；Obsidian 把同行文本当标题——不支持）。
 * - Obsidian 折叠标记 `[!note]-` / `[!note]+` v1 不识别 → 普通引用块，原文保留。
 * - 行尾允许硬换行标记（`\` 或空白）：WYSIWYG 的行内软换行序列化为 `\`+换行，
 *   自家往返后的标记行（`> [!NOTE]\`）必须仍能识别，否则预览失识别（对 GitHub
 *   严格口径的有意放宽，代价是 `[!NOTE]\` 在 GitHub 上只是普通引用）。
 * - 开括号允许转义形态（`\[!NOTE]`）：Milkdown 序列化会把 `[` 转义防误判链接，
 *   WYSIWYG 保存后的文件必须双端仍识别（解码后语义相同，GitHub 亦按文本识别）。
 */

export const githubAlertTypes = ['note', 'tip', 'important', 'warning', 'caution'] as const

export type GithubAlertType = (typeof githubAlertTypes)[number]

/**
 * 标记行：`[!TYPE]` 独占一行，返回小写类型名；不匹配返回 null。
 * 容忍：大小写、开括号转义（`\[`）、尾部空白与硬换行 `\`（见文件头决策说明）。
 */
export function matchAlertMarkerLine(line: string): GithubAlertType | null {
  const m = line.match(/^\\?\[!([A-Za-z]+)\][ \t\\]*$/)
  if (!m) return null
  const type = m[1].toLowerCase()
  return (githubAlertTypes as readonly string[]).includes(type) ? (type as GithubAlertType) : null
}
