// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - plantuml-encoder has no type declarations
import { encode } from 'plantuml-encoder'

/**
 * 生成 PlantUML 在线渲染服务的 SVG URL
 * preview 渲染（parser.ts）与 WYSIWYG nodeview 共用，保证同一图源
 * @throws 编码失败时抛异常（调用方决定降级展示）
 */
export function getPlantUmlSvgUrl(content: string): string {
  const encoded = encode(content.trim())
  return `https://www.plantuml.com/plantuml/svg/${encoded}`
}
