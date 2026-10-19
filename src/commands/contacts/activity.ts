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

interface ActivityItem {
  id: string
  action: string
  description: string | null
  createdAt: string
  userAgent: string | null
  link: string | null
  metadata:
    | string
    | number
    | boolean
    | unknown[]
    | Record<string, unknown>
    | null
  broadcast: { id: string, name: string | null } | null
  email: { id: string, subject: string | null } | null
}

interface ActivityListResponse {
  items: ActivityItem[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'action', label: 'Action' },
  { key: 'description', label: 'Description', format: (v: string) => v || '-' },
  { key: 'createdAt', label: 'Date', format: (v: string) => new Date(v).toLocaleString() }
]

export default defineCommand({
  meta: { name: 'activity', description: 'List activity for a contact' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    id: { type: 'positional', description: 'Contact ID', required: true }
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

    const buildQuery = (pagination: PaginationRequest) => paginationQuery(pagination)

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching activity...' },
          () => client.get<ActivityListResponse>(`/contacts/${args.id}/activity`, buildQuery(args))
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate({
          fetch: pagination => client.get<ActivityListResponse>(`/contacts/${args.id}/activity`, buildQuery(pagination)),
          render: (items) => table(items, columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching activity...' },
        () => client.get<ActivityListResponse>(`/contacts/${args.id}/activity`, buildQuery(args))
      )

      table(result.items, columns)
      printPaginationInfo(`sevk contacts activity ${args.id}`, args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
