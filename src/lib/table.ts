import pc from 'picocolors'

interface Column {
  key: string
  label: string
  width?: number
  format?: (value: any) => string
}

function visibleWidth(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length
}

function padEnd(str: string, width: number): string {
  const diff = width - visibleWidth(str)
  return diff > 0 ? str + ' '.repeat(diff) : str
}

function truncate(str: string, width: number): string {
  if (visibleWidth(str) <= width) return str
  // Simple truncation: slice and re-check
  let result = str
  while (visibleWidth(result) > width - 1 && result.length > 0) {
    result = result.slice(0, -1)
  }
  return result + '…'
}

export function table(data: Record<string, any>[], columns: Column[]): void {
  if (data.length === 0) {
    console.log(pc.dim('  No results found.'))
    return
  }

  // Calculate column widths (last column is uncapped)
  const widths = columns.map((col, i) => {
    const headerLen = visibleWidth(col.label)
    const maxDataLen = data.reduce((max, row) => {
      const val = col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')
      return Math.max(max, visibleWidth(val))
    }, 0)
    const natural = Math.max(headerLen, maxDataLen) + 2
    if (col.width) return col.width
    return i === columns.length - 1 ? natural : Math.min(natural, 40)
  })

  // Header
  const header = columns.map((col, i) => pc.bold(padEnd(col.label, widths[i]))).join('  ')
  console.log(header)
  console.log(pc.dim('─'.repeat(widths.reduce((a, b) => a + b + 2, -2))))

  // Rows
  for (const row of data) {
    const line = columns
      .map((col, i) => {
        const raw = col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')
        return padEnd(truncate(raw, widths[i]), widths[i])
      })
      .join('  ')
    console.log(line)
  }
}

export function keyValue(pairs: [string, string][]): void {
  const maxKey = pairs.reduce((max, [k]) => Math.max(max, visibleWidth(k)), 0)
  for (const [key, value] of pairs) {
    console.log(`  ${pc.dim(padEnd(key, maxKey + 2))}${value}`)
  }
}
