import { schemaCtx } from '@milkdown/kit/core'
import { DOMParser } from '@milkdown/kit/prose/model'
import type { Schema } from '@milkdown/kit/prose/model'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { $prose } from '@milkdown/kit/utils'

/**
 * 严格 `<br>` 解析（幻影 hardbreak 的治本方案，v2）
 *
 * WKWebView + 中文 IME 组合输入时，浏览器会在 DOM 里插入无属性 `<br>` 占位
 * 节点（预编辑文本分音节处、块尾占位等）；PM 默认的解析规则（`{tag: "br"}`）
 * 把它们收编为 hardbreak 节点——输入过程中渲染成可见空行（闪烁），上屏后
 * 序列化成 `\` 垃圾行。
 *
 * 本插件提供自定义 domParser 视图 prop（readDOMChange 与剪贴板解析都会经
 * `someProp("domParser")` 命中），br 规则收紧为：
 * - `br[data-type="hardbreak"]`（PM 自己渲染的 hardbreak，必带此属性）→
 *   hardbreak 节点，编辑器内复制/粘贴与 DOM 回读无损；
 * - 其余裸 `<br>` → `ignore: true` 整块跳过，不产出任何节点或文本。
 *
 * 注意与 v1 的区别：v1 用 getAttrs=false 让规则不匹配，裸 br 落入
 * leafFallback 变成 `\n` 文本、再被折叠成空格——空格混进文本流会干扰 PM 的
 * diff 对齐，导致上屏错位（「拼接」回归）。ignore 规则什么都不产生，无此问题。
 * 代价：从外部网页复制的裸 `<br>` 不再转换为硬换行（可接受）。
 *
 * （$prose 工厂在 SchemaReady 之后执行，schemaCtx 必然已就绪）
 */
export const strictBrParserPlugin = $prose((ctx) => {
  return new Plugin({
    key: new PluginKey('vividmark-strict-br-parser'),
    props: {
      domParser: buildStrictBrParser(ctx.get(schemaCtx)),
    },
  })
})

function buildStrictBrParser(schema: Schema): DOMParser {
  const base = DOMParser.fromSchema(schema)
  const tags = base.tags
    // 移除默认的裸 br → hardbreak 规则
    .filter((rule) => rule.tag !== 'br')
    .concat([
      // PM 渲染的 hardbreak 带 data-type 属性，优先匹配；data-is-inline 保真
      {
        tag: 'br[data-type="hardbreak"]',
        node: 'hardbreak',
        priority: 70,
        getAttrs: (dom: HTMLElement) => ({
          isInline: dom.getAttribute('data-is-inline') === 'true',
        }),
      },
      // 裸 br（浏览器占位节点）整块忽略，不产生任何节点/文本
      {
        tag: 'br',
        ignore: true,
        priority: 60,
      },
    ])
  return new DOMParser(schema, tags, base.styles)
}
