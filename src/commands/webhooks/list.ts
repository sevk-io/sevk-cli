import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, isMenuMode, json } from '~/lib/output'
import type { PaginationRequest } from '~/lib/pagination'
import {
  assertCursorExclusive,
  interactivePaginate,
  paginationArgs,
  paginationQuery,
  printPaginationInfo
} from '~/lib/pagination'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
  secret: string | null
  failureCount: number
  lastFailureAt: string | null
  lastDeliveryAt: string | null
  disabledAt: string | null
  projectId: string
  createdAt: string
  updatedAt: string
}

interface ListResponse {
  items: Webhook[]
  total?: number
  totalPages?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
  availableEvents: Record<string, { name: string, description: string, category: string }>
}

const renderWebhooks = (items: Webhook[]) => {
  if (items.length === 0) {
    console.log('\n  No webhooks found.\n')

    return
  }

  const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : '-')
  const hasHealth = items.some((w) =>
    w.failureCount !== undefined ||
    'lastFailureAt' in w ||
    'lastDeliveryAt' in w ||
    'disabledAt' in w
  )

  const rows = items.map((w) => {
    const row: Record<string, string | number> = {
      id: w.id,
      url: w.url,
      events: Array.isArray(w.events) ? w.events.length + ' events' : '-',
      enabled: w.disabledAt ? 'Disabled' : w.enabled ? 'Yes' : 'No'
    }

    if (hasHealth) {
      row.failures = w.failureCount ?? 0
      row.lastDelivery = fmtDate(w.lastDeliveryAt)
      row.lastFailure = fmtDate(w.lastFailureAt)
    }

    return row
  })

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'url', label: 'URL' },
    { key: 'events', label: 'Events' },
    { key: 'enabled', label: 'Enabled' }
  ]

  if (hasHealth) {
    columns.push(
      { key: 'failures', label: 'Failures' },
      { key: 'lastDelivery', label: 'Last delivery' },
      { key: 'lastFailure', label: 'Last failure' }
    )
  }

  console.log()
  table(rows, columns)
  console.log()
}

export default defineCommand({
  meta: { name: 'list', description: 'List webhooks' },
  args: { ...globalArgs, ...paginationArgs },
  async run({ args }) {
    try {
      assertCursorExclusive(args)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const buildQuery = (pagination: PaginationRequest) =>
      paginationQuery(pagination)

    try {
      if (isJsonOutput(args)) {
        const data = await withSpinner(
          { start: 'Fetching webhooks...' },
          () => client.get<ListResponse>('/webhooks', buildQuery(args))
        )

        json(data)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate<Webhook>({
          fetch: pagination => client.get<ListResponse>('/webhooks', buildQuery(pagination)),
          render: renderWebhooks,
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const data = await withSpinner(
        { start: 'Fetching webhooks...' },
        () => client.get<ListResponse>('/webhooks', buildQuery(args))
      )

      renderWebhooks(data.items)
      printPaginationInfo('sevk webhooks list', args, data)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
