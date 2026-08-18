import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import { commonmark, remarkPreserveEmptyLinePlugin } from '@milkdown/kit/preset/commonmark'
import { gfm, remarkGFMPlugin, strikethroughInputRule } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener } from '@milkdown/kit/plugin/listener'
import { admonitionSchema, remarkAdmonitionPlugin } from './admonitionPlugin'
import { admonitionView } from './admonitionView'
import { codeHighlightPlugin } from './codeHighlightPlugin'
import { frontmatterSchema, remarkFrontmatterPlugin } from './frontmatterPlugin'
import { frontmatterView } from './frontmatterView'
import { footnoteDecorationPlugin } from './footnoteDecorations'
import { githubAlertDecorationPlugin } from './githubAlertDecorations'
import { hardbreakCleanupPlugin } from './hardbreakCleanupPlugin'
import { hardbreakView } from './hardbreakView'
import { strictBrParserPlugin } from './strictBrParserPlugin'
import { imeEnterGuardPlugin } from './imeEnterGuardPlugin'
import { imageView } from './imageView'
import {
  mathInlineInputRule,
  mathBlockSchema,
  mathInlineSchema,
  remarkMathPlugin,
} from './mathPlugin'
import { mathBlockView, mathInlineView } from './mathView'
import { plantUmlCodeBlockView } from './plantUmlCodeBlockView'
import { taskListItemView } from './taskListItemView'
import {
  markHighlightInputRule,
  markHighlightSchema,
  remarkGFMNoSingleTilde,
  remarkTypographyPlugin,
  strikethroughDoubleTildeInputRule,
  subscriptInputRule,
  subscriptSchema,
  superscriptInputRule,
  superscriptSchema,
} from './typographyPlugin'
import { wysiwygHistoryPlugin } from './wysiwygHistoryPlugin'
import { wysiwygActiveHeadingPlugin } from './wysiwygActiveHeadingPlugin'
import { wysiwygEnterPlugin, wysiwygShortcutPlugin } from './wysiwygFormat'

/**
 * commonmark 预设剔除 remark-preserve-empty-line（二元组引用比较）。
 *
 * 该插件把空段落序列化为独立 `<br />` html 行——用户视其为垃圾行
 * （Typora 直接丢弃空段落；markdown 渲染时空行本来就会折叠）。
 * 剔除后：空段落序列化为普通空行（重新加载时自然折叠）；
 * 源码中已有的独立 `<br />` 行解析为 html 节点，保留不丢。
 */
const preserveEmptyLineParts = new Set<unknown>([
  remarkPreserveEmptyLinePlugin[0],
  remarkPreserveEmptyLinePlugin[1],
])
const commonmarkPreset = commonmark.filter((plugin) => !preserveEmptyLineParts.has(plugin))

/**
 * gfm 预设剔除两项（引用比较）：
 * - remarkGFMPlugin：改由 remarkGFMNoSingleTilde 以 { singleTilde: false } 重注册，
 *   把单 `~` 让给下标（见 typographyPlugin.ts）
 * - strikethroughInputRule：改由 strikethroughDoubleTildeInputRule 替代
 *   （原规则会把单 `~` 输入转成删除线并序列化为 `~~`）
 */
const gfmPreset = gfm.filter(
  (plugin) =>
    (plugin as unknown) !== remarkGFMPlugin && (plugin as unknown) !== strikethroughInputRule
)

/** WYSIWYG 使用的 Milkdown 插件集合（导出供测试复用，保持与组件一致） */
export const wysiwygPlugins: MilkdownPlugin[] = [
  // Enter 键位（软换行模型）必须排在 commonmark 之前以获得 handleKeyDown 优先级
  wysiwygEnterPlugin,
  ...commonmarkPreset,
  ...gfmPreset,
  // gfm 重注册（singleTilde: false）必须在 typography 之前：同字符 `~` 的
  // tokenizer 按注册序尝试，strikethrough 先认领 `~~`，单 `~` 落到 subscript
  ...remarkGFMNoSingleTilde,
  // 排版增强（==mark== / ^sup^ / ~sub~）：remark 解析/序列化 + mark schema
  ...remarkTypographyPlugin,
  ...markHighlightSchema,
  ...superscriptSchema,
  ...subscriptSchema,
  markHighlightInputRule,
  superscriptInputRule,
  subscriptInputRule,
  strikethroughDoubleTildeInputRule,
  ...history,
  listener,
  wysiwygHistoryPlugin,
  wysiwygActiveHeadingPlugin,
  taskListItemView,
  plantUmlCodeBlockView,
  imageView,
  // $remark / $nodeSchema 返回 [ctx, plugin] 二元组，两个插件都需注册。
  // admonition 的 remark 变换必须在 commonmark 的 remarkLineBreak 之后运行
  // （软换行先转成 break 节点，围栏行才能被识别为独立段）；
  // admonition schema 必须在 commonmark 之后注册（否则成为 schema 第一个
  // block 类型，PM createAndFill 填充 content:'block+' 时递归选自身栈溢出）
  ...remarkAdmonitionPlugin,
  ...admonitionSchema,
  admonitionView,
  // math：$remark 注册 micromark/mdast 扩展（解析+序列化），schema 顺序约束同 admonition
  ...remarkMathPlugin,
  ...mathInlineSchema,
  ...mathBlockSchema,
  mathInlineView,
  mathBlockView,
  mathInlineInputRule,
  // frontmatter：micromark 层解析（仅文档开头 `---` 围栏），schema 顺序约束同 admonition
  ...remarkFrontmatterPlugin,
  ...frontmatterSchema,
  frontmatterView,
  codeHighlightPlugin,
  wysiwygShortcutPlugin,
  strictBrParserPlugin,
  hardbreakCleanupPlugin,
  hardbreakView,
  imeEnterGuardPlugin,
  // GitHub Alerts：blockquote 首行 [!TYPE] 的纯装饰（零 schema 变更，位置无顺序约束）
  githubAlertDecorationPlugin,
  // 脚注编号：footnote_reference/definition 节点由 gfm 预设自带，此处只做序号装饰
  footnoteDecorationPlugin,
]
