/**
 * 表格工具函数
 * 提供 Markdown 表格的生成和编辑功能
 */

/**
 * 生成 Markdown 表格
 * @param rows 行数（不包括表头）
 * @param cols 列数
 * @param headers 可选的表头数组
 * @returns Markdown 表格字符串
 */
export function generateTable(rows: number, cols: number, headers?: string[]): string {
  // 生成默认表头
  const headerRow =
    headers && headers.length === cols
      ? headers
      : Array.from({ length: cols }, (_, i) => `Column ${i + 1}`)

  // 生成分隔行
  const separator = Array.from({ length: cols }, () => '---').join(' | ')

  // 生成表头行
  const header = headerRow.join(' | ')

  // 生成数据行
  const dataRows = Array.from({ length: rows }, (_, rowIdx) =>
    Array.from({ length: cols }, (_, colIdx) => `Cell ${rowIdx + 1}-${colIdx + 1}`).join(' | ')
  )

  // 组合表格
  return [header, separator, ...dataRows].join('\n')
}

/**
 * 解析 Markdown 表格
 * @param tableText Markdown 表格文本
 * @returns 解析后的表格数据，如果不是有效表格则返回 null
 */
export interface ParsedTable {
  headers: string[]
  rows: string[][]
  alignments: ('left' | 'center' | 'right' | null)[]
}

export function parseTable(tableText: string): ParsedTable | null {
  const lines = tableText
    .trim()
    .split('\n')
    .filter((line) => line.trim())

  if (lines.length < 2) {
    return null
  }

  // 解析表头
  const headers = lines[0]
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell)
  const colCount = headers.length

  if (colCount === 0) {
    return null
  }

  // 解析分隔行（判断对齐方式）
  const separatorCells = lines[1]
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell)
  const alignments: ('left' | 'center' | 'right' | null)[] = separatorCells.map((cell) => {
    const leftColon = cell.startsWith(':')
    const rightColon = cell.endsWith(':')

    if (leftColon && rightColon) return 'center'
    if (leftColon) return 'left'
    if (rightColon) return 'right'
    return null
  })

  // 验证分隔行是否是有效的分隔符
  const isValidSeparator = separatorCells.every((cell) => /^:?-+:?$/.test(cell))
  if (!isValidSeparator) {
    return null
  }

  // 解析数据行
  const rows: string[][] = []
  for (let i = 2; i < lines.length; i++) {
    // 分割并保留所有单元格（包括空的）
    const cells = lines[i].split('|')

    // 处理单元格：
    // 1. 如果行以 | 开头，第一个元素是空字符串 - 这是实际的单元格内容（空）
    // 2. 如果行以 | 结尾，最后一个元素是空字符串 - 这只是语法产生的，应该忽略
    let processedCells = cells.map((c) => c.trim())

    // 只有当最后一个元素是空字符串且 cells 数量超过预期时，才移除最后一个
    // 例如：`a | b |` → `['a ', ' b ', '']`，最后一个 '' 应该移除
    // 但 ` | 2 | 3` → `['', '', '2', '3']`，不应该移除任何内容
    if (processedCells.length > colCount && processedCells[processedCells.length - 1] === '') {
      processedCells = processedCells.slice(0, -1)
    }

    // 如果行以 | 开头，第一个空字符串是第一个单元格的内容
    // 但我们已经保留了它，所以不需要特殊处理

    // 补齐缺失的单元格
    while (processedCells.length < colCount) {
      processedCells.push('')
    }

    rows.push(processedCells.slice(0, colCount))
  }

  return { headers, rows, alignments }
}

/**
 * 将解析后的表格转换回 Markdown 格式
 * @param table 解析后的表格数据
 * @returns Markdown 表格字符串
 */
export function tableToMarkdown(table: ParsedTable): string {
  const { headers, rows, alignments } = table

  // 生成表头
  const headerLine = headers.join(' | ')

  // 生成分隔行（带对齐标记）
  // 使用固定3个破折号作为基础长度，满足 GFM 表格要求
  const separatorCells = alignments.map((align) => {
    if (align === 'center') return ':---:'
    if (align === 'left') return ':---'
    if (align === 'right') return '---:'
    return '---'
  })
  const separatorLine = separatorCells.join(' | ')

  // 生成数据行
  const dataLines = rows.map((row) => row.map((cell) => cell || '').join(' | '))

  return [headerLine, separatorLine, ...dataLines].join('\n')
}

/**
 * 在表格中添加一行
 * @param tableText 原始表格文本
 * @param rowIndex 插入位置（在该行之前插入，如果为 -1 则在末尾添加）
 * @param rowData 可选的行数据
 * @returns 更新后的表格文本
 */
export function addTableRow(tableText: string, rowIndex: number = -1, rowData?: string[]): string {
  const table = parseTable(tableText)
  if (!table) return tableText

  const { headers, rows, alignments } = table
  const colCount = headers.length

  // 生成默认行数据
  const newRow = rowData || Array.from({ length: colCount }, () => '')

  // 补齐缺失的单元格
  while (newRow.length < colCount) {
    newRow.push('')
  }

  // 插入新行
  if (rowIndex === -1 || rowIndex > rows.length) {
    rows.push(newRow.slice(0, colCount))
  } else {
    rows.splice(rowIndex, 0, newRow.slice(0, colCount))
  }

  return tableToMarkdown({ headers, rows, alignments })
}

/**
 * 在表格中添加一列
 * @param tableText 原始表格文本
 * @param colIndex 插入位置（在该列之前插入，如果为 -1 则在末尾添加）
 * @param header 列标题
 * @returns 更新后的表格文本
 */
export function addTableColumn(
  tableText: string,
  colIndex: number = -1,
  header: string = 'New Column'
): string {
  const table = parseTable(tableText)
  if (!table) return tableText

  const { headers, rows, alignments } = table

  // 确定插入位置
  const insertIdx = colIndex === -1 || colIndex > headers.length ? headers.length : colIndex

  // 在表头中插入
  headers.splice(insertIdx, 0, header)

  // 在对齐数组中插入
  alignments.splice(insertIdx, 0, null)

  // 在每行数据中插入
  rows.forEach((row) => {
    row.splice(insertIdx, 0, '')
  })

  return tableToMarkdown({ headers, rows, alignments })
}

/**
 * 删除表格中的一行
 * @param tableText 原始表格文本
 * @param rowIndex 要删除的行索引
 * @returns 更新后的表格文本
 */
export function deleteTableRow(tableText: string, rowIndex: number): string {
  const table = parseTable(tableText)
  if (!table || rowIndex < 0 || rowIndex >= table.rows.length) {
    return tableText
  }

  const { headers, rows, alignments } = table
  rows.splice(rowIndex, 1)

  return tableToMarkdown({ headers, rows, alignments })
}

/**
 * 删除表格中的一列
 * @param tableText 原始表格文本
 * @param colIndex 要删除的列索引
 * @returns 更新后的表格文本
 */
export function deleteTableColumn(tableText: string, colIndex: number): string {
  const table = parseTable(tableText)
  if (!table || colIndex < 0 || colIndex >= table.headers.length) {
    return tableText
  }

  const { headers, rows, alignments } = table

  // 如果只剩一列，删除整个表格
  if (headers.length <= 1) {
    return ''
  }

  headers.splice(colIndex, 1)
  alignments.splice(colIndex, 1)
  rows.forEach((row) => row.splice(colIndex, 1))

  return tableToMarkdown({ headers, rows, alignments })
}

/**
 * 检查文本是否是有效的 Markdown 表格
 * @param text 要检查的文本
 * @returns 是否为有效表格
 */
export function isValidTable(text: string): boolean {
  return parseTable(text) !== null
}

/**
 * 格式化表格（对齐所有列的宽度）
 * @param tableText 原始表格文本
 * @returns 格式化后的表格文本
 */
export function formatTable(tableText: string): string {
  const table = parseTable(tableText)
  if (!table) return tableText

  const { headers, rows, alignments } = table

  // 计算每列的最大宽度
  const colWidths: number[] = []

  // 检查表头
  headers.forEach((header, idx) => {
    colWidths[idx] = Math.max(colWidths[idx] || 0, header.length)
  })

  // 检查所有数据行
  rows.forEach((row) => {
    row.forEach((cell, idx) => {
      colWidths[idx] = Math.max(colWidths[idx] || 0, cell.length)
    })
  })

  // 确保最小宽度为 3（分隔符要求）
  for (let i = 0; i < colWidths.length; i++) {
    colWidths[i] = Math.max(3, colWidths[i] || 0)
  }

  // 格式化单元格
  const padCell = (cell: string, idx: number): string => {
    const width = colWidths[idx] || 0
    return cell.padEnd(width, ' ')
  }

  // 格式化表头
  const formattedHeader = headers.map(padCell).join(' | ')

  // 格式化分隔行
  const formattedSeparator = alignments
    .map((align, idx) => {
      const width = colWidths[idx] || 3
      const dashes = '-'.repeat(width)

      // 对齐标记：居中需要至少3个破折号，如 :---:
      // 左对齐：:--- 或 :---:
      // 右对齐：---: 或 :---:
      if (align === 'center') return `:${dashes}:`
      if (align === 'left') return `:${dashes}`
      if (align === 'right') return `${dashes}:`
      return dashes
    })
    .join(' | ')

  // 格式化数据行
  const formattedRows = rows.map((row) => row.map((cell, idx) => padCell(cell, idx)).join(' | '))

  return [formattedHeader, formattedSeparator, ...formattedRows].join('\n')
}
