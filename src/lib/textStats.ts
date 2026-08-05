/**
 * 文本统计工具
 *
 * Words = 拉丁词序列 + CJK 单字；Chars = 总字符数
 * 状态栏与原 Sidebar 底部统计共用此算法
 */

export interface TextStats {
  words: number
  chars: number
}

export function getTextStats(content: string): TextStats {
  const chars = content.length
  const words = (content.match(/[a-zA-Z0-9]+(?:['_-][a-zA-Z0-9]+)*|[一-鿿㐀-䶿]/gu) || []).length
  return { chars, words }
}
