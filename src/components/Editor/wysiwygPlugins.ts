import type { MilkdownPlugin } from '@milkdown/kit/ctx'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { history } from '@milkdown/kit/plugin/history'
import { listener } from '@milkdown/kit/plugin/listener'
import { admonitionSchema, remarkAdmonitionPlugin } from './admonitionPlugin'
import { admonitionView } from './admonitionView'
import { codeHighlightPlugin } from './codeHighlightPlugin'
import { hardbreakCleanupPlugin } from './hardbreakCleanupPlugin'
import { hardbreakView } from './hardbreakView'
import { strictBrParserPlugin } from './strictBrParserPlugin'
import { imeEnterGuardPlugin } from './imeEnterGuardPlugin'
import { imageView } from './imageView'
import { plantUmlCodeBlockView } from './plantUmlCodeBlockView'
import { taskListItemView } from './taskListItemView'
import { wysiwygHistoryPlugin } from './wysiwygHistoryPlugin'
import { wysiwygActiveHeadingPlugin } from './wysiwygActiveHeadingPlugin'
import { wysiwygEnterPlugin, wysiwygShortcutPlugin } from './wysiwygFormat'

/** WYSIWYG 使用的 Milkdown 插件集合（导出供测试复用，保持与组件一致） */
export const wysiwygPlugins: MilkdownPlugin[] = [
  // Enter 键位（软换行模型）必须排在 commonmark 之前以获得 handleKeyDown 优先级
  wysiwygEnterPlugin,
  ...commonmark,
  ...gfm,
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
  codeHighlightPlugin,
  wysiwygShortcutPlugin,
  strictBrParserPlugin,
  hardbreakCleanupPlugin,
  hardbreakView,
  imeEnterGuardPlugin,
]
