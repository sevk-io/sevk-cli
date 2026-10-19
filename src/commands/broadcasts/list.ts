import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
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

const statusColor: Record<string, (s: string) => string> = {
  DRAFT: pc.dim,
  SCHEDULED: pc.yellow,
  STARTING: pc.yellow,
  SENDING: pc.blue,
  SENT: pc.green,
  CANCELLING: pc.yellow,
  CANCELLED: pc.red,
  FAILED: pc.red
}

const BROADCAST_STATUSES = [
  'CANCELLED',
  'CANCELLING',
  'DRAFT',
  'FAILED',
  'SCHEDULED',
  'SENDING',
  'SENT',
  'STARTING'
] as const

interface BroadcastListItem {
  id: string
  name?: string | null
  subject?: string | null
  status: string
  createdAt: string
}

interface ListResponse {
  items: BroadcastListItem[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', format: (v: string) => v || '-' },
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status', format: (v: string) => (statusColor[v] || pc.white)(v) },
  { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() }
]

export default defineCommand({
  meta: { name: 'list', description: 'List broadcasts' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    status: { type: 'string', description: 'Filter by status (DRAFT, SCHEDULED, STARTING, SENDING, SENT, CANCELLING, CANCELLED, FAILED)' },
    search: { type: 'string', description: 'Search by name or subject' }
  },
  async run({ args }) {
    try {
      assertCursorExclusive(args)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))

    const buildQuery = (pagination: PaginationRequest) => {
      const q = paginationQuery(pagination)

      if (args.status !== undefined) {
        q.status = parseEnumFlag(args.status, '--status', BROADCAST_STATUSES, {
          uppercase: true
        })
      }

      if (args.search) {
        q.search = args.search
      }

      return q
    }

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching broadcasts...' },
          () => client.get<ListResponse>('/broadcasts', buildQuery(args))
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate({
          fetch: pagination => client.get<ListResponse>('/broadcasts', buildQuery(pagination)),
          render: (items) => table(items, columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching broadcasts...' },
        () => client.get<ListResponse>('/broadcasts', buildQuery(args))
      )

      table(result.items, columns)
      printPaginationInfo('sevk broadcasts list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
