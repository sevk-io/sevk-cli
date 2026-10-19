import pc from 'picocolors'

export const paginationArgs = {
  page: { type: 'string' as const, description: 'Offset mode: page number (mutually exclusive with --after / --before)' },
  limit: { type: 'string' as const, description: 'Items per page (1-100)', default: '20' },
  after: { type: 'string' as const, description: 'Cursor mode: id of last item from previous page (mutually exclusive with --page / --before)' },
  before: { type: 'string' as const, description: 'Cursor mode: id of first item from next page, walks backward (mutually exclusive with --page / --after)' }
} as const

export type PaginationArgs = {
  page?: string
  limit?: string
  after?: string
  before?: string
}

export type PaginationRequest = {
  page?: string | number
  limit?: string | number
  after?: string
  before?: string
}

export type PaginationResult<T> = {
  items: T[]
  total?: number
  totalPages?: number
  page?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

export const assertCursorExclusive = (args: PaginationArgs): void => {
  if (args.after !== undefined && args.before !== undefined) {
    throw new Error('--after and --before are mutually exclusive, pass only one')
  }

  if (args.page !== undefined && (args.after !== undefined || args.before !== undefined)) {
    throw new Error('--page and cursor flags are mutually exclusive, pass only one pagination mode')
  }
}

export const paginationQuery = (
  pagination: PaginationRequest
): Record<string, string | number | boolean | undefined> => {
  const query: Record<string, string | number | boolean | undefined> = {}

  if (pagination.after !== undefined) {
    query.after = pagination.after
  } else if (pagination.before !== undefined) {
    query.before = pagination.before
  } else if (pagination.page !== undefined) {
    query.page = pagination.page
  }

  if (pagination.limit !== undefined) {
    query.limit = pagination.limit
  }

  return query
}

export const printPaginationInfo = (
  commandHint: string,
  args: PaginationArgs,
  result: { total?: number, hasMore?: boolean, nextCursor?: string | null, prevCursor?: string | null } | undefined
): void => {
  const totals = result ?? {}

  if (totals.hasMore !== undefined && (totals.nextCursor !== undefined || totals.prevCursor !== undefined)) {
    // Direction-aware hint: callers using `--before` are walking backward
    // and want the prevCursor to continue in that direction. Callers using
    // `--after` (or no cursor at all) want the nextCursor for forward
    // navigation. Same content, opposite cursor.
    const wentBackward = args.before !== undefined

    if (wentBackward) {
      if (totals.hasMore && totals.prevCursor) {
        console.log(`\n${pc.dim(`prev: ${commandHint} --before ${totals.prevCursor}`)}`)
      }
    } else {
      if (totals.hasMore && totals.nextCursor) {
        console.log(`\n${pc.dim(`next: ${commandHint} --after ${totals.nextCursor}`)}`)
      }
    }

    return
  }

  const total = totals.total

  if (!total) {
    return
  }

  const page = Number(args.page || 1)
  const limit = Number(args.limit || 20)
  const totalPages = Math.ceil(total / limit)

  if (totalPages <= 1) {
    return
  }

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

const waitForKey = (): Promise<'left' | 'right' | 'escape'> => {
  return new Promise((resolve) => {
    process.stdin.setRawMode?.(true)
    process.stdin.resume()

    const onData = (data: Buffer) => {
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      process.stdin.removeListener('data', onData)

      const seq = data.toString()

      if (seq === '\x1b[D' || seq === 'h') {
        return resolve('left')
      }

      if (seq === '\x1b[C' || seq === 'l') {
        return resolve('right')
      }

      return resolve('escape')
    }

    process.stdin.on('data', onData)
  })
}

export const interactivePaginate = async <T>(opts: {
  fetch: (pagination: PaginationRequest) => Promise<PaginationResult<T>>
  render: (items: T[]) => void
  limit?: number
  args?: PaginationArgs
}): Promise<void> => {
  const limit = opts.limit || 20
  const offsetMode = opts.args?.page !== undefined

  if (offsetMode) {
    let page = Number(opts.args?.page || 1)

    while (true) {
      console.clear()

      const result = await opts.fetch({ page, limit })
      const total = result.total ?? 0
      const totalPages = result.totalPages ?? (Math.ceil(total / limit) || 1)

      opts.render(result.items)

      if (totalPages <= 1) {
        break
      }

      const parts: string[] = []

      if (page > 1) {
        parts.push(pc.dim('← prev'))
      }

      parts.push(`${pc.bold(`${page}`)}/${totalPages} (${total} total)`)
      if (page < totalPages) {
        parts.push(pc.dim('next →'))
      }

      parts.push(pc.dim('enter: back'))
      console.log(`\n${parts.join('  ')}`)

      const key = await waitForKey()

      if (key === 'left' && page > 1) {
        page--
      } else if (key === 'right' && page < totalPages) {
        page++
      } else if (key === 'escape') {
        break
      }
    }

    return
  }

  let current: PaginationRequest = {
    limit,
    ...(opts.args?.after !== undefined ? { after: opts.args.after } : {}),
    ...(opts.args?.before !== undefined ? { before: opts.args.before } : {})
  }
  const history: PaginationRequest[] = []

  while (true) {
    console.clear()

    const result = await opts.fetch(current)

    opts.render(result.items)

    const goingBackward = current.before !== undefined
    const nextCursor = goingBackward ? result.prevCursor : result.nextCursor
    const canGoBack = history.length > 0
    const canGoForward = result.hasMore === true && !!nextCursor

    if (!canGoBack && !canGoForward) {
      break
    }

    const cursorPage = history.length + 1
    const parts: string[] = []

    if (canGoBack) {
      parts.push(pc.dim('← prev'))
    }

    parts.push(pc.bold(`Page ${cursorPage}`))
    if (canGoForward) {
      parts.push(pc.dim('next →'))
    }

    parts.push(pc.dim('enter: back'))
    console.log(`\n${parts.join('  ')}`)

    const key = await waitForKey()

    if (key === 'left' && canGoBack) {
      const previous = history.pop()

      if (previous) {
        current = previous
      }
    } else if (key === 'right' && result.hasMore && nextCursor) {
      history.push(current)
      current = goingBackward
        ? { before: nextCursor, limit }
        : { after: nextCursor, limit }
    } else if (key === 'escape') {
      break
    }
  }
}
