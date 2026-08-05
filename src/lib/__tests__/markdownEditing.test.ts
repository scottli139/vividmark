import { describe, it, expect } from 'vitest'
import { EditorState, EditorSelection, type TransactionSpec } from '@codemirror/state'
import {
  applyInlineFormat,
  toggleBlockFormat,
  formatTransaction,
  insertTextAtCursor,
  isBlockFormat,
} from '../markdownEditing'

/** 创建带选区的编辑器状态 */
function stateWith(doc: string, anchor: number, head = anchor): EditorState {
  return EditorState.create({ doc, selection: EditorSelection.single(anchor, head) })
}

/** 应用 TransactionSpec 并返回新状态 */
function applySpec(state: EditorState, spec: TransactionSpec): EditorState {
  return state.update(spec).state
}

describe('isBlockFormat', () => {
  it('should identify block formats', () => {
    expect(isBlockFormat('h1')).toBe(true)
    expect(isBlockFormat('h2')).toBe(true)
    expect(isBlockFormat('h3')).toBe(true)
    expect(isBlockFormat('quote')).toBe(true)
    expect(isBlockFormat('list')).toBe(true)
    expect(isBlockFormat('tasklist')).toBe(true)
  })

  it('should identify inline formats', () => {
    expect(isBlockFormat('bold')).toBe(false)
    expect(isBlockFormat('italic')).toBe(false)
    expect(isBlockFormat('strike')).toBe(false)
    expect(isBlockFormat('code')).toBe(false)
    expect(isBlockFormat('link')).toBe(false)
    expect(isBlockFormat('image')).toBe(false)
    expect(isBlockFormat('codeblock')).toBe(false)
  })
})

describe('applyInlineFormat', () => {
  it('should wrap selection with bold markers', () => {
    const state = stateWith('hello world', 0, 5)
    const next = applySpec(state, applyInlineFormat(state, 'bold'))

    expect(next.doc.toString()).toBe('**hello** world')
    // 光标移到格式化文本之后
    expect(next.selection.main.head).toBe(9)
    expect(next.selection.main.empty).toBe(true)
  })

  it('should wrap selection with italic markers', () => {
    const state = stateWith('hello world', 6, 11)
    const next = applySpec(state, applyInlineFormat(state, 'italic'))

    expect(next.doc.toString()).toBe('hello *world*')
    expect(next.selection.main.head).toBe(13)
  })

  it('should insert placeholder and select it when no selection', () => {
    const state = stateWith('', 0)
    const next = applySpec(state, applyInlineFormat(state, 'bold'))

    expect(next.doc.toString()).toBe('**bold text**')
    // 选中占位词
    expect(next.selection.main.anchor).toBe(2)
    expect(next.selection.main.head).toBe(11)
  })

  it('should insert placeholder at cursor position', () => {
    const state = stateWith('ab', 1)
    const next = applySpec(state, applyInlineFormat(state, 'italic'))

    expect(next.doc.toString()).toBe('a*italic text*b')
    expect(next.selection.main.anchor).toBe(2)
    expect(next.selection.main.head).toBe(13)
  })

  it('should insert link syntax and select placeholder', () => {
    const state = stateWith('', 0)
    const next = applySpec(state, applyInlineFormat(state, 'link'))

    expect(next.doc.toString()).toBe('[link text](url)')
    expect(next.selection.main.anchor).toBe(1)
    expect(next.selection.main.head).toBe(10)
  })

  it('should wrap selection as code block', () => {
    const state = stateWith('code', 0, 4)
    const next = applySpec(state, applyInlineFormat(state, 'codeblock'))

    expect(next.doc.toString()).toBe('```\ncode\n```')
  })

  it('should insert strikethrough placeholder', () => {
    const state = stateWith('', 0)
    const next = applySpec(state, applyInlineFormat(state, 'strike'))

    expect(next.doc.toString()).toBe('~~strikethrough~~')
  })

  it('should throw for block formats', () => {
    const state = stateWith('text', 0)
    expect(() => applyInlineFormat(state, 'h1')).toThrow()
  })
})

describe('toggleBlockFormat', () => {
  it('should add heading prefix to current line', () => {
    const state = stateWith('Hello', 2)
    const next = applySpec(state, toggleBlockFormat(state, 'h1'))

    expect(next.doc.toString()).toBe('# Hello')
  })

  it('should remove heading prefix when toggled again', () => {
    const state = stateWith('# Hello', 4)
    const next = applySpec(state, toggleBlockFormat(state, 'h1'))

    expect(next.doc.toString()).toBe('Hello')
  })

  it('should replace existing heading prefix with another level', () => {
    const state = stateWith('# Hello', 3)
    const next = applySpec(state, toggleBlockFormat(state, 'h2'))

    expect(next.doc.toString()).toBe('## Hello')
  })

  it('should replace quote prefix when applying heading', () => {
    const state = stateWith('> quote', 3)
    const next = applySpec(state, toggleBlockFormat(state, 'h1'))

    expect(next.doc.toString()).toBe('# quote')
  })

  it('should replace list prefix when applying quote', () => {
    const state = stateWith('- item', 3)
    const next = applySpec(state, toggleBlockFormat(state, 'quote'))

    expect(next.doc.toString()).toBe('> item')
  })

  it('should add tasklist prefix', () => {
    const state = stateWith('task', 0)
    const next = applySpec(state, toggleBlockFormat(state, 'tasklist'))

    expect(next.doc.toString()).toBe('- [ ] task')
  })

  it('should apply prefix to all lines in multi-line selection', () => {
    const doc = 'a\nb\nc'
    const state = stateWith(doc, 0, doc.length)
    const next = applySpec(state, toggleBlockFormat(state, 'list'))

    expect(next.doc.toString()).toBe('- a\n- b\n- c')
  })

  it('should remove prefix from all lines when all have it', () => {
    const doc = '- a\n- b\n- c'
    const state = stateWith(doc, 0, doc.length)
    const next = applySpec(state, toggleBlockFormat(state, 'list'))

    expect(next.doc.toString()).toBe('a\nb\nc')
  })

  it('should only affect the current line without selection', () => {
    const state = stateWith('first\nsecond', 8)
    const next = applySpec(state, toggleBlockFormat(state, 'quote'))

    expect(next.doc.toString()).toBe('first\n> second')
  })

  it('should map cursor position through changes', () => {
    const state = stateWith('Hello', 3)
    const next = applySpec(state, toggleBlockFormat(state, 'h1'))

    // CM 自动映射选区：原光标 3 → 加上 '# ' 后应为 5
    expect(next.selection.main.head).toBe(5)
  })

  it('should throw for inline formats', () => {
    const state = stateWith('text', 0)
    expect(() => toggleBlockFormat(state, 'bold')).toThrow()
  })
})

describe('formatTransaction', () => {
  it('should dispatch inline formats', () => {
    const state = stateWith('hi', 0, 2)
    const next = applySpec(state, formatTransaction(state, 'bold'))
    expect(next.doc.toString()).toBe('**hi**')
  })

  it('should dispatch block formats', () => {
    const state = stateWith('hi', 0)
    const next = applySpec(state, formatTransaction(state, 'h3'))
    expect(next.doc.toString()).toBe('### hi')
  })
})

describe('insertTextAtCursor', () => {
  it('should insert text at cursor position', () => {
    const state = stateWith('ab', 1)
    const next = applySpec(state, insertTextAtCursor(state, 'X'))

    expect(next.doc.toString()).toBe('aXb')
    expect(next.selection.main.head).toBe(2)
  })

  it('should replace selection with inserted text', () => {
    const state = stateWith('hello world', 0, 5)
    const next = applySpec(state, insertTextAtCursor(state, 'img'))

    expect(next.doc.toString()).toBe('img world')
    expect(next.selection.main.head).toBe(3)
  })

  it('should insert table markdown at cursor', () => {
    const table = '| A | B |\n|---|---|'
    const state = stateWith('', 0)
    const next = applySpec(state, insertTextAtCursor(state, table))

    expect(next.doc.toString()).toBe(table)
    expect(next.selection.main.head).toBe(table.length)
  })
})
