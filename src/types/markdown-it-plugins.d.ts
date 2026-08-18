/**
 * markdown-it-mark / markdown-it-sub / markdown-it-sup 无官方类型包，
 * 本地声明（三者均为无参 markdown-it 插件）。
 * markdown-it-emoji 使用 @types/markdown-it-emoji。
 */
declare module 'markdown-it-mark' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sub' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}

declare module 'markdown-it-sup' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt) => void
  export default plugin
}
