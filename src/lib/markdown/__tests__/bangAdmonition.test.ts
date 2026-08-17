/**
 * `!!!` admonition 文本预处理器测试（WYSIWYG 解析前挂点，见 bangAdmonition.ts）
 *
 * 核心契约：`!!!` 缩进块 → 内部 `:::!` 形式；围栏代码块 / `:::` 容器内部不动；
 * 内容含 `:::` 标记时不转换（防 `:::!` 泄漏改写用户源码）。
 */
import { describe, it, expect } from 'vitest'
import { parseBangMarker, preprocessBangAdmonitions } from '../bangAdmonition'

describe('parseBangMarker', () => {
  it('解析类型与三种标题形态', () => {
    expect(parseBangMarker('!!! note')).toEqual({ type: 'note', title: '' })
    expect(parseBangMarker('!!! warning "自定义标题"')).toEqual({
      type: 'warning',
      title: '自定义标题',
    })
    expect(parseBangMarker("!!! tip '单引号'")).toEqual({ type: 'tip', title: '单引号' })
    expect(parseBangMarker('!!! danger 无引号标题')).toEqual({
      type: 'danger',
      title: '无引号标题',
    })
  })

  it('类型名小写化；未知类型保留', () => {
    expect(parseBangMarker('!!! NOTE')?.type).toBe('note')
    expect(parseBangMarker('!!! abstract')?.type).toBe('abstract')
  })

  it('不匹配：!!!! / ??? / 非字母类型 / 缩进 4 空格', () => {
    expect(parseBangMarker('!!!! note')).toBeNull()
    expect(parseBangMarker('??? note')).toBeNull()
    expect(parseBangMarker('!!! 123')).toBeNull()
    expect(parseBangMarker('    !!! note')).toBeNull()
  })
})

describe('preprocessBangAdmonitions', () => {
  it('无 !!! 时原样返回（快路径）', () => {
    const src = '# 标题\n\n普通段落'
    expect(preprocessBangAdmonitions(src)).toBe(src)
  })

  it('基本转换：标记行 + 4 空格缩进内容', () => {
    const out = preprocessBangAdmonitions('!!! note\n    内容')
    expect(out).toBe(':::! note\n内容\n:::')
  })

  it('标题剥引号后进入内部形式', () => {
    const out = preprocessBangAdmonitions('!!! warning "注意"\n    内容')
    expect(out).toBe(':::! warning 注意\n内容\n:::')
  })

  it('多段内容：空行悬挂仍归属容器', () => {
    const out = preprocessBangAdmonitions('!!! note\n    第一段\n\n    第二段')
    expect(out).toBe(':::! note\n第一段\n\n第二段\n:::')
  })

  it('未缩进行截断：容器结束，后续为普通段落', () => {
    const out = preprocessBangAdmonitions('!!! note\n    内容\n后续段落')
    expect(out).toBe(':::! note\n内容\n:::\n后续段落')
  })

  it('尾部空行不属于容器', () => {
    const out = preprocessBangAdmonitions('!!! note\n    内容\n\n\n后续')
    expect(out).toBe(':::! note\n内容\n:::\n后续')
  })

  it('空容器（仅标记行）', () => {
    expect(preprocessBangAdmonitions('!!! note')).toBe(':::! note\n:::')
    expect(preprocessBangAdmonitions('!!! note\n后续')).toBe(':::! note\n:::\n后续')
  })

  it('tab 缩进内容 dedent 一级', () => {
    const out = preprocessBangAdmonitions('!!! note\n\t内容')
    expect(out).toBe(':::! note\n内容\n:::')
  })

  it('更深缩进保留余量（容器内代码块）', () => {
    const out = preprocessBangAdmonitions('!!! note\n        code')
    expect(out).toBe(':::! note\n    code\n:::')
  })

  it('嵌套 bang：dedent 后递归转换', () => {
    const out = preprocessBangAdmonitions(
      '!!! note\n    外层\n\n    !!! tip "内层"\n        内层内容'
    )
    expect(out).toBe(':::! note\n外层\n\n:::! tip 内层\n内层内容\n:::\n:::')
  })

  it('围栏代码块内的 !!! 不转换', () => {
    const src = '```text\n!!! note\n    不是提示框\n```'
    expect(preprocessBangAdmonitions(src)).toBe(src)
  })

  it('::: 容器内的 !!! 不转换（colon 配对机制不支持混入）', () => {
    const src = '::: note\n!!! tip\n    不转换\n:::'
    expect(preprocessBangAdmonitions(src)).toBe(src)
  })

  it('内容含 ::: 标记时不转换（防 :::! 泄漏改写源码）', () => {
    const src = '!!! note\n    ::: tip\n    内容'
    expect(preprocessBangAdmonitions(src)).toBe(src)
  })

  it('??? 可折叠语法与 !!!! 不动（超出范围，保持原文）', () => {
    const src = '??? note\n    折叠内容\n\n!!!! bang'
    expect(preprocessBangAdmonitions(src)).toBe(src)
  })

  it('引用/列表内的 !!! 不转换（已知边界：保持原文降级）', () => {
    const src = '> !!! note\n>     引用内'
    expect(preprocessBangAdmonitions(src)).toBe(src)
  })
})
