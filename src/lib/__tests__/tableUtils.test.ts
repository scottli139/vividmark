import { describe, it, expect } from 'vitest'
import {
  generateTable,
  parseTable,
  tableToMarkdown,
  addTableRow,
  addTableColumn,
  deleteTableRow,
  deleteTableColumn,
  isValidTable,
  formatTable,
  type ParsedTable,
} from '../tableUtils'

describe('tableUtils', () => {
  describe('generateTable', () => {
    it('should generate a basic table with default headers', () => {
      const result = generateTable(2, 3)
      const expected = `Column 1 | Column 2 | Column 3
--- | --- | ---
Cell 1-1 | Cell 1-2 | Cell 1-3
Cell 2-1 | Cell 2-2 | Cell 2-3`
      expect(result).toBe(expected)
    })

    it('should generate a table with custom headers', () => {
      const headers = ['Name', 'Age', 'City']
      const result = generateTable(1, 3, headers)
      expect(result).toContain('Name | Age | City')
      expect(result).toContain('Cell 1-1 | Cell 1-2 | Cell 1-3')
    })

    it('should handle single row and column', () => {
      const result = generateTable(1, 1)
      const expected = `Column 1
---
Cell 1-1`
      expect(result).toBe(expected)
    })

    it('should handle empty custom headers by using defaults', () => {
      const result = generateTable(1, 2, [])
      expect(result).toContain('Column 1 | Column 2')
    })

    it('should handle mismatched header count', () => {
      const result = generateTable(1, 3, ['Only', 'Two'])
      expect(result).toContain('Column 1 | Column 2 | Column 3')
    })
  })

  describe('parseTable', () => {
    it('should parse a valid table', () => {
      const tableText = `Name | Age | City
--- | --- | ---
Alice | 25 | NYC
Bob | 30 | LA`
      const result = parseTable(tableText)

      expect(result).not.toBeNull()
      expect(result!.headers).toEqual(['Name', 'Age', 'City'])
      expect(result!.rows).toEqual([
        ['Alice', '25', 'NYC'],
        ['Bob', '30', 'LA'],
      ])
      expect(result!.alignments).toEqual([null, null, null])
    })

    it('should parse table with alignments', () => {
      const tableText = `Name | Age | Score
:--- | :---: | ---:
Alice | 25 | 95`
      const result = parseTable(tableText)

      expect(result).not.toBeNull()
      expect(result!.alignments).toEqual(['left', 'center', 'right'])
    })

    it('should return null for invalid table (no separator)', () => {
      const result = parseTable('Just a header\nSome content')
      expect(result).toBeNull()
    })

    it('should return null for invalid separator', () => {
      const result = parseTable('Header\nInvalid separator\nData')
      expect(result).toBeNull()
    })

    it('should handle empty cells', () => {
      const tableText = `A | B | C
--- | --- | ---
 | 2 | 3
4 |  | 6`
      const result = parseTable(tableText)

      expect(result).not.toBeNull()
      expect(result!.rows[0]).toEqual(['', '2', '3'])
      expect(result!.rows[1]).toEqual(['4', '', '6'])
    })

    it('should handle extra whitespace', () => {
      const tableText = `  Name  |  Age  
  ---  |  ---  
  Alice  |  25  `
      const result = parseTable(tableText)

      expect(result).not.toBeNull()
      expect(result!.headers).toEqual(['Name', 'Age'])
      expect(result!.rows[0]).toEqual(['Alice', '25'])
    })

    it('should handle empty rows at end', () => {
      const tableText = `A | B
--- | ---
1 | 2


`
      const result = parseTable(tableText)

      expect(result).not.toBeNull()
      expect(result!.rows).toHaveLength(1)
    })
  })

  describe('tableToMarkdown', () => {
    it('should convert parsed table back to markdown', () => {
      const table: ParsedTable = {
        headers: ['Name', 'Age'],
        rows: [['Alice', '25']],
        alignments: [null, null],
      }
      const result = tableToMarkdown(table)

      expect(result).toContain('Name | Age')
      expect(result).toContain('--- | ---')
      expect(result).toContain('Alice | 25')
    })

    it('should preserve alignments', () => {
      const table: ParsedTable = {
        headers: ['Name', 'Age', 'Score'],
        rows: [['Alice', '25', '95']],
        alignments: ['left', 'center', 'right'],
      }
      const result = tableToMarkdown(table)

      expect(result).toContain(':--- | :---: | ---:')
    })

    it('should handle empty cells', () => {
      const table: ParsedTable = {
        headers: ['A', 'B'],
        rows: [['', 'value']],
        alignments: [null, null],
      }
      const result = tableToMarkdown(table)

      expect(result).toContain(' | value')
    })
  })

  describe('addTableRow', () => {
    const baseTable = `Name | Age
--- | ---
Alice | 25
Bob | 30`

    it('should add a row at the end by default', () => {
      const result = addTableRow(baseTable)
      const parsed = parseTable(result)

      expect(parsed!.rows).toHaveLength(3)
      expect(parsed!.rows[2]).toEqual(['', ''])
    })

    it('should add a row at specified position', () => {
      const result = addTableRow(baseTable, 1)
      const parsed = parseTable(result)

      expect(parsed!.rows).toHaveLength(3)
      expect(parsed!.rows[1]).toEqual(['', ''])
      expect(parsed!.rows[2]).toEqual(['Bob', '30'])
    })

    it('should add a row with custom data', () => {
      const result = addTableRow(baseTable, -1, ['Charlie', '35'])
      const parsed = parseTable(result)

      expect(parsed!.rows[2]).toEqual(['Charlie', '35'])
    })

    it('should pad short row data with empty strings', () => {
      const result = addTableRow(baseTable, -1, ['Charlie'])
      const parsed = parseTable(result)

      expect(parsed!.rows[2]).toEqual(['Charlie', ''])
    })

    it('should truncate long row data', () => {
      const result = addTableRow(baseTable, -1, ['Charlie', '35', 'Extra'])
      const parsed = parseTable(result)

      expect(parsed!.rows[2]).toEqual(['Charlie', '35'])
    })

    it('should return original text for invalid table', () => {
      const invalid = 'Not a table'
      expect(addTableRow(invalid)).toBe(invalid)
    })
  })

  describe('addTableColumn', () => {
    const baseTable = `Name | Age
--- | ---
Alice | 25`

    it('should add a column at the end by default', () => {
      const result = addTableColumn(baseTable)
      const parsed = parseTable(result)

      expect(parsed!.headers).toHaveLength(3)
      expect(parsed!.headers[2]).toBe('New Column')
      expect(parsed!.rows[0]).toHaveLength(3)
    })

    it('should add a column at specified position', () => {
      const result = addTableColumn(baseTable, 1, 'City')
      const parsed = parseTable(result)

      expect(parsed!.headers).toEqual(['Name', 'City', 'Age'])
      expect(parsed!.rows[0]).toEqual(['Alice', '', '25'])
    })

    it('should add column at beginning', () => {
      const result = addTableColumn(baseTable, 0, 'ID')
      const parsed = parseTable(result)

      expect(parsed!.headers[0]).toBe('ID')
      expect(parsed!.rows[0][0]).toBe('')
    })

    it('should return original text for invalid table', () => {
      const invalid = 'Not a table'
      expect(addTableColumn(invalid)).toBe(invalid)
    })
  })

  describe('deleteTableRow', () => {
    const baseTable = `Name | Age
--- | ---
Alice | 25
Bob | 30
Charlie | 35`

    it('should delete a row at specified index', () => {
      const result = deleteTableRow(baseTable, 1)
      const parsed = parseTable(result)

      expect(parsed!.rows).toHaveLength(2)
      expect(parsed!.rows[0]).toEqual(['Alice', '25'])
      expect(parsed!.rows[1]).toEqual(['Charlie', '35'])
    })

    it('should return original text for invalid index', () => {
      const result = deleteTableRow(baseTable, 10)
      expect(parseTable(result)!.rows).toHaveLength(3)
    })

    it('should return original text for negative index', () => {
      const result = deleteTableRow(baseTable, -1)
      expect(parseTable(result)!.rows).toHaveLength(3)
    })

    it('should return original text for invalid table', () => {
      const invalid = 'Not a table'
      expect(deleteTableRow(invalid, 0)).toBe(invalid)
    })
  })

  describe('deleteTableColumn', () => {
    const baseTable = `A | B | C
--- | --- | ---
1 | 2 | 3
4 | 5 | 6`

    it('should delete a column at specified index', () => {
      const result = deleteTableColumn(baseTable, 1)
      const parsed = parseTable(result)

      expect(parsed!.headers).toEqual(['A', 'C'])
      expect(parsed!.rows[0]).toEqual(['1', '3'])
      expect(parsed!.rows[1]).toEqual(['4', '6'])
    })

    it('should return empty string when deleting last column', () => {
      const singleColTable = `A
---
1
2`
      const result = deleteTableColumn(singleColTable, 0)

      expect(result).toBe('')
    })

    it('should return original text for invalid index', () => {
      const result = deleteTableColumn(baseTable, 10)
      expect(parseTable(result)!.headers).toHaveLength(3)
    })

    it('should return original text for invalid table', () => {
      const invalid = 'Not a table'
      expect(deleteTableColumn(invalid, 0)).toBe(invalid)
    })
  })

  describe('isValidTable', () => {
    it('should return true for valid table', () => {
      expect(
        isValidTable(`A | B
--- | ---
1 | 2`)
      ).toBe(true)
    })

    it('should return false for plain text', () => {
      expect(isValidTable('Just some text')).toBe(false)
    })

    it('should return false for code block', () => {
      expect(isValidTable('```\ncode\n```')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isValidTable('')).toBe(false)
    })
  })

  describe('formatTable', () => {
    it('should format table with consistent column widths', () => {
      const messyTable = `A | BC | D
--- | --- | ---
1 | 234 | 5`
      const result = formatTable(messyTable)
      const lines = result.split('\n')

      // 表头、分隔符、数据行应该对齐
      expect(lines[0]).toContain('A   | BC  | D')
      expect(lines[1]).toContain('--- | --- | ---')
      expect(lines[2]).toContain('1   | 234 | 5')
    })

    it('should preserve alignments when formatting', () => {
      const tableWithAlign = `Name | Age
:--- | ---:
Alice | 25`
      const result = formatTable(tableWithAlign)

      expect(result).toContain(':---')
      expect(result).toContain('---:')
    })

    it('should return original text for invalid table', () => {
      const invalid = 'Not a table'
      expect(formatTable(invalid)).toBe(invalid)
    })

    it('should handle cells with varying content lengths', () => {
      const table = `Short | Very Long Header
--- | ---
X | This is a very long cell content`
      const result = formatTable(table)

      // 所有行的列宽应该一致
      const lines = result.split('\n')
      const headerCols = lines[0].split('|')
      const sepCols = lines[1].split('|')
      const dataCols = lines[2].split('|')

      expect(headerCols).toHaveLength(2)
      expect(sepCols).toHaveLength(2)
      expect(dataCols).toHaveLength(2)
    })
  })
})
