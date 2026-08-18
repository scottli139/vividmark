import remarkGfm from 'remark-gfm'
import { classifyCharacter } from 'micromark-util-classify-character'
import { splice } from 'micromark-util-chunked'
import { resolveAll } from 'micromark-util-resolve-all'
import { codes, constants, types } from 'micromark-util-symbol'
import type {
  Code,
  Event,
  Extension as MicromarkExtension,
  State,
  Token,
  TokenizeContext,
  Tokenizer,
} from 'micromark-util-types'
import type {
  CompileContext,
  Extension as FromMarkdownExtension,
  Handle as FromMarkdownHandle,
} from 'mdast-util-from-markdown'
import type {
  ConstructName,
  Handle as ToMarkdownHandle,
  Info as ToMarkdownInfo,
  Options as ToMarkdownExtension,
  State as ToMarkdownState,
} from 'mdast-util-to-markdown'
import type { Parent as MdastParent, PhrasingContent } from 'mdast'
import type { Processor } from 'unified'
import { $inputRule, $markSchema, $remark } from '@milkdown/kit/utils'
import { markRule } from '@milkdown/kit/prose'
import { strikethroughSchema } from '@milkdown/kit/preset/gfm'

/**
 * 排版增强语法 Milkdown 支持：`==高亮==` / `^上标^` / `~下标~`（FR-023.4）。
 *
 * 四部分（micromark 层仿 micromark-extension-gfm-strikethrough 2.x 实现）：
 * 1. pairedDelimiter micromark 扩展工厂：定长配对分隔符（mark=`==`、sup=`^`、
 *    sub=`~`），flanking 规则与 GFM strikethrough 一致（字母/数字相邻可字内配对，
 *    空白相邻不配对：`== x ==` 不解析）。
 * 2. remarkTypography：注册三种语法的 micromark 解析 + mdast fromMarkdown +
 *    toMarkdown 序列化扩展（mdast 节点类型 mark / superscript / subscript，
 *    均为 children 行内容器，序列化恒回原始分隔符）。
 * 3. remarkGFMNoSingleTilde：替代 gfm 预设自带的 remarkGFMPlugin，
 *    以 { singleTilde: false } 重新注册——单 `~` 让给 subscript
 *    （`~~` 删除线不受影响；单 `~` 删除线在本应用内统一为 pandoc/Typora 式下标，
 *    与预览侧 markdown-it-sub 对齐）。
 * 4. $markSchema ×3 + input rules（含 strikethroughInputRule 的 `~~` 限定替代版，
 *    原规则 `(~{1,2})` 会把单 `~` 输入转成删除线、序列化成 `~~`，改写用户源码）。
 *
 * emoji（:smile:）按既定决策只做预览侧（markdown-it-emoji），WYSIWYG 显示
 * 字面短码文本，零往返风险，本文件不涉及。
 */

// ==================== 1. micromark 扩展（定长配对分隔符） ====================

type PairedType = 'mark' | 'superscript' | 'subscript'

interface PairedDelimiterConfig {
  /** 构造基名：生成 <name>SequenceTemporary / <name>Sequence / <name>Text token */
  name: PairedType
  /** 分隔字符码 */
  marker: Code
  /** 分隔符定长（mark=2，sup/sub=1）；不等长的序列整体不解析 */
  size: number
}

function pairedDelimiter(config: PairedDelimiterConfig): MicromarkExtension {
  const { name, marker, size } = config
  const sequenceTemporary = `${name}SequenceTemporary`
  const sequence = `${name}Sequence`
  const textType = `${name}Text`

  const tokenizer = {
    name,
    tokenize: tokenizePairedDelimiter,
    resolveAll: resolveAllPairedDelimiter,
  }

  return {
    // marker 是具体字符码（codes.equalsTo / caret / tilde），不会为 null
    text: { [marker as number]: tokenizer },
    insideSpan: { null: [tokenizer] },
    attentionMarkers: { null: [marker] },
  }

  /**
   * 配对解析（照搬 strikethrough 的 resolveAll：闭合序列向前找开放序列，
   * 中间事件经 insideSpan 重新解析后包进容器 token）。
   */
  function resolveAllPairedDelimiter(events: Event[], context: TokenizeContext): Event[] {
    let index = -1

    while (++index < events.length) {
      if (
        events[index][0] === 'enter' &&
        events[index][1].type === sequenceTemporary &&
        events[index][1]._close
      ) {
        let open = index

        while (open--) {
          if (
            events[open][0] === 'exit' &&
            events[open][1].type === sequenceTemporary &&
            events[open][1]._open
            // 分隔符定长，两侧长度必然相等，无需 strikethrough 的长度比较
          ) {
            events[index][1].type = sequence as Token['type']
            events[open][1].type = sequence as Token['type']

            const container: Token = {
              type: name as Token['type'],
              start: Object.assign({}, events[open][1].start),
              end: Object.assign({}, events[index][1].end),
            }
            const text: Token = {
              type: textType as Token['type'],
              start: Object.assign({}, events[open][1].end),
              end: Object.assign({}, events[index][1].start),
            }

            const nextEvents: Event[] = [
              ['enter', container, context],
              ['enter', events[open][1], context],
              ['exit', events[open][1], context],
              ['enter', text, context],
            ]

            const insideSpan = context.parser.constructs.insideSpan.null
            if (insideSpan) {
              splice(
                nextEvents,
                nextEvents.length,
                0,
                resolveAll(insideSpan, events.slice(open + 1, index), context)
              )
            }

            splice(nextEvents, nextEvents.length, 0, [
              ['exit', text, context],
              ['enter', events[index][1], context],
              ['exit', events[index][1], context],
              ['exit', container, context],
            ])

            splice(events, open - 1, index - open + 3, nextEvents)
            index = open + nextEvents.length - 2
            break
          }
        }
      }
    }

    index = -1
    while (++index < events.length) {
      if (events[index][1].type === sequenceTemporary) {
        events[index][1].type = types.data
      }
    }

    return events
  }

  /** @this {TokenizeContext} */
  function tokenizePairedDelimiter(
    this: TokenizeContext,
    effects: Parameters<Tokenizer>[0],
    ok: Parameters<Tokenizer>[1],
    nok: Parameters<Tokenizer>[2]
  ): State {
    const previous = this.previous
    const events = this.events
    let sizeCount = 0

    return start

    function start(code: Code): State | undefined {
      // 前一个字符是同款标记（且非转义产物）时不是定界起点——
      // 长序列整体让给先注册的构造（如 gfm strikethrough 的 `~~`）
      if (previous === marker && events[events.length - 1][1].type !== types.characterEscape) {
        return nok(code)
      }

      effects.enter(sequenceTemporary as Token['type'])
      return more(code)
    }

    function more(code: Code): State | undefined {
      const before = classifyCharacter(previous)

      if (code === marker) {
        effects.consume(code)
        sizeCount++
        return more
      }

      if (sizeCount !== size) return nok(code)

      const token = effects.exit(sequenceTemporary as Token['type'])
      const after = classifyCharacter(code)
      // flanking 规则与 GFM strikethrough 相同：
      // 字母/数字相邻（非空白非标点）既可开也可闭（字内配对），
      // 空白相邻不可，标点相邻需对侧非空白
      token._open = !after || (after === constants.characterGroupPunctuation && Boolean(before))
      token._close = !before || (before === constants.characterGroupPunctuation && Boolean(after))
      return ok(code)
    }
  }
}

// ==================== 2. mdast fromMarkdown / toMarkdown 扩展 ====================

/** 行内容器节点（mark / superscript / subscript），类型即 token 名 */
interface PairedNode extends MdastParent {
  type: PairedType
  children: PhrasingContent[]
}

function pairedFromMarkdown(type: PairedType): FromMarkdownExtension {
  const enter: FromMarkdownHandle = function (this: CompileContext, token) {
    this.enter({ type, children: [] } as unknown as Parameters<CompileContext['enter']>[0], token)
  }
  const exit: FromMarkdownHandle = function (this: CompileContext, token) {
    this.exit(token)
  }
  return {
    canContainEols: [type],
    enter: { [type]: enter },
    exit: { [type]: exit },
  }
}

// 与 mdast-util-gfm-strikethrough 相同：这些构造内的分隔字符不可转义，原样输出
const constructsWithoutPairedDelimiter: ConstructName[] = [
  'autolink',
  'destinationLiteral',
  'destinationRaw',
  'reference',
  'titleQuote',
  'titleApostrophe',
]

function pairedToMarkdown(
  type: PairedType,
  delimiter: string,
  unsafeCharacter: string,
  unsafeBefore?: string
): ToMarkdownExtension {
  const handle = function (
    node: PairedNode,
    _parent: unknown,
    state: ToMarkdownState,
    info: ToMarkdownInfo
  ): string {
    const tracker = state.createTracker(info)
    const exit = state.enter(type as ConstructName)
    let value = tracker.move(delimiter)
    value += state.containerPhrasing(
      node as unknown as Parameters<ToMarkdownState['containerPhrasing']>[0],
      {
        ...tracker.current(),
        before: value,
        after: delimiter[0],
      }
    )
    value += tracker.move(delimiter)
    exit()
    return value
  } as ToMarkdownHandle & { peek: () => string }
  handle.peek = () => delimiter[0]

  return {
    // 防误解析：phrasing 文本中的分隔字符转义。
    // `=` 只转义紧跟 `=` 的第二个（单 `=` 永不构成分隔符，避免 `a = b` 被污染为 `a \= b`）；
    // `^` 任意单个即可两两配对，必须全转义；
    // `~` 已由 gfm strikethrough 的 unsafe 覆盖（全转义），此处无需重复。
    unsafe: [
      {
        character: unsafeCharacter,
        ...(unsafeBefore ? { before: unsafeBefore } : {}),
        inConstruct: 'phrasing',
        notInConstruct: constructsWithoutPairedDelimiter,
      },
    ],
    handlers: { [type]: handle },
  }
}

// ==================== 3. remark 插件 ====================

/** 排版增强语法（==mark== / ^sup^ / ~sub~）解析 + 序列化全注册 */
function remarkTypography(this: Processor) {
  const data = this.data()
  const micromarkExtensions = data.micromarkExtensions || (data.micromarkExtensions = [])
  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])
  const toMarkdownExtensions = data.toMarkdownExtensions || (data.toMarkdownExtensions = [])

  micromarkExtensions.push(
    pairedDelimiter({ name: 'mark', marker: codes.equalsTo, size: 2 }),
    pairedDelimiter({ name: 'superscript', marker: codes.caret, size: 1 }),
    pairedDelimiter({ name: 'subscript', marker: codes.tilde, size: 1 })
  )
  fromMarkdownExtensions.push(
    pairedFromMarkdown('mark'),
    pairedFromMarkdown('superscript'),
    pairedFromMarkdown('subscript')
  )
  toMarkdownExtensions.push(
    pairedToMarkdown('mark', '==', '=', '='),
    pairedToMarkdown('superscript', '^', '^'),
    pairedToMarkdown('subscript', '~', '~')
  )
}

export const remarkTypographyPlugin = $remark('remarkTypography', () => remarkTypography)

/**
 * gfm 预设自带的 remarkGFMPlugin 以默认参数注册（singleTilde: true，
 * GitHub 式单 `~` 删除线）。为把单 `~` 让给下标（pandoc/Typora 式，与预览侧
 * markdown-it-sub 对齐），在 wysiwygPlugins 中过滤原插件后以 singleTilde: false
 * 重注册（`~~` 删除线解析不受影响）。
 */
export const remarkGFMNoSingleTilde = $remark('remarkGFM', () => remarkGfm, {
  singleTilde: false,
})

// ==================== 4. PM mark schema + input rules ====================

interface MarkSchemaConfig {
  markName: PairedType
  tag: 'mark' | 'sup' | 'sub'
}

function createMarkSchema(config: MarkSchemaConfig) {
  return $markSchema(config.markName, () => ({
    parseDOM: [{ tag: config.tag }],
    toDOM: () => [config.tag],
    parseMarkdown: {
      match: (node) => node.type === config.markName,
      runner: (state, node, markType) => {
        state.openMark(markType)
        state.next(node.children)
        state.closeMark(markType)
      },
    },
    toMarkdown: {
      match: (mark) => mark.type.name === config.markName,
      runner: (state, mark) => {
        state.withMark(mark, config.markName)
      },
    },
  }))
}

export const markHighlightSchema = createMarkSchema({ markName: 'mark', tag: 'mark' })
export const superscriptSchema = createMarkSchema({ markName: 'superscript', tag: 'sup' })
export const subscriptSchema = createMarkSchema({ markName: 'subscript', tag: 'sub' })

// 输入规则：键入闭合分隔符时转成对应 mark（Typora 同款体验，仿 strikethroughInputRule）。
// 内容首尾非空白、内不含分隔字符，与 micromark 解析行为对齐
export const markHighlightInputRule = $inputRule((ctx) =>
  markRule(/(?<!=)==([^\s=](?:[^=]*[^\s=])?)==$/, markHighlightSchema.type(ctx))
)
export const superscriptInputRule = $inputRule((ctx) =>
  markRule(/(?<!\^)\^([^\s^](?:[^^]*[^\s^])?)\^$/, superscriptSchema.type(ctx))
)
export const subscriptInputRule = $inputRule((ctx) =>
  markRule(/(?<!~)~([^\s~](?:[^~]*[^\s~])?)~$/, subscriptSchema.type(ctx))
)

/**
 * gfm 预设 strikethroughInputRule 的 `~~` 限定替代版。
 * 原规则 `(~{1,2})` 会匹配单 `~` 并转成删除线 mark（序列化为 `~~`），
 * 在 singleTilde: false 下会改写用户输入的下标语义，必须一并替换。
 */
export const strikethroughDoubleTildeInputRule = $inputRule((ctx) =>
  markRule(/(?<![\w:/~])~~(.+?)~~$/, strikethroughSchema.type(ctx))
)
