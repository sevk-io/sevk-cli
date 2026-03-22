import pc from 'picocolors'
import { isInteractive } from './output'

export const paginationArgs = {
  page: { type: 'string' as const, description: 'Page number', default: '1' },
  limit: { type: 'string' as const, description: 'Items per page', default: '20' },
} as const

export type PaginationArgs = {
  page?: string
  limit?: string
}

export function printPaginationInfo(
  commandHint: string,
  args: PaginationArgs,
  total?: number,
): void {
  if (!total) return

  const page = Number(args.page || 1)
  const limit = Number(args.limit || 20)
  const totalPages = Math.ceil(total / limit)

  if (totalPages <= 1) return

  const parts: string[] = []

  if (page > 1) {
    parts.push(pc.dim(`prev: ${commandHint} --page ${page - 1}`))
  }

  parts.push(`${pc.bold(`${page}`)}/${totalPages} (${total} total)`)

  if (page < totalPages) {
    parts.push(pc.dim(`next: ${commandHint} --page ${page + 1}`))
  }

  console.log(`\n${parts.join('  ')}`)
}

function waitForKey(): Promise<'left' | 'right' | 'escape'> {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()

    const onData = (data: Buffer) => {
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdin.removeListener('data', onData)

      const seq = data.toString()

      // Arrow left: \x1b[D
      if (seq === '\x1b[D' || seq === 'h') return resolve('left')
      // Arrow right: \x1b[C
      if (seq === '\x1b[C' || seq === 'l') return resolve('right')
      // Everything else (Enter, ESC, q, etc.) → escape
      return resolve('escape')
    }

    process.stdin.on('data', onData)
  })
}

export async function interactivePaginate(opts: {
  fetch: (page: number, limit: number) => Promise<{ items: any[]; total: number; [k: string]: any }>,
  render: (items: any[]) => void,
  limit?: number,
  startPage?: number,
}): Promise<void> {
  const limit = opts.limit || 20
  let page = opts.startPage || 1

  while (true) {
    console.clear()

    const result = await opts.fetch(page, limit)
    const items = result.items || []
    const total = result.total || 0
    const totalPages = Math.ceil(total / limit) || 1

    opts.render(items)

    if (totalPages <= 1) break

    const parts: string[] = []
    if (page > 1) parts.push(pc.dim('← prev'))
    parts.push(`${pc.bold(`${page}`)}/${totalPages} (${total} total)`)
    if (page < totalPages) parts.push(pc.dim('next →'))
    parts.push(pc.dim('enter: back'))
    console.log(`\n${parts.join('  ')}`)

    const key = await waitForKey()
    if (key === 'left' && page > 1) page--
    else if (key === 'right' && page < totalPages) page++
    else if (key === 'escape') break
  }
}
