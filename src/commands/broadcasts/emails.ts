import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, isMenuMode, json } from '~/lib/output'
import type { PaginationRequest } from '~/lib/pagination'
import {
  assertCursorExclusive,
  interactivePaginate,
  paginationArgs,
  paginationQuery
} from '~/lib/pagination'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

interface BroadcastEmail {
  to?: string | null
  contact?: { email?: string | null } | null
  status?: string | null
  openedAt?: string | null
  clickedAt?: string | null
  createdAt?: string | null
}

interface EmailsResponse {
  items: BroadcastEmail[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
  page?: number
  totalPages?: number
}

const columns = [
  { key: 'to', label: 'To' },
  { key: 'status', label: 'Status' },
  { key: 'opened', label: 'Opened' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'sentAt', label: 'Sent At' }
]

const mapItems = (items: BroadcastEmail[]) => {
  return items.map((e) => ({
    to: e.contact?.email || e.to,
    status: e.status,
    opened: e.openedAt ? 'Yes' : '-',
    clicked: e.clickedAt ? 'Yes' : '-',
    sentAt: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '-'
  }))
}

export default defineCommand({
  meta: { name: 'emails', description: 'List emails sent by a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
    ...paginationArgs
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
    const endpoint = `/broadcasts/${args.id}/emails`

    const buildQuery = (pagination: PaginationRequest) => paginationQuery(pagination)

    try {
      if (isJsonOutput(args)) {
        const data = await withSpinner(
          { start: 'Fetching emails...' },
          () => client.get<EmailsResponse>(endpoint, buildQuery(args))
        )

        json(data)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate({
          fetch: pagination => client.get<EmailsResponse>(endpoint, buildQuery(pagination)),
          render: (items) => {
            if (items.length === 0) {
              console.log('\n  No emails found.\n')

              return
            }

            console.log()
            table(mapItems(items), columns)
          },
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const data = await withSpinner(
        { start: 'Fetching emails...' },
        () => client.get<EmailsResponse>(endpoint, buildQuery(args))
      )
      const items = data.items

      if (items.length === 0) {
        console.log('\n  No emails found.\n')

        return
      }

      console.log()
      table(mapItems(items), columns)
      if (data.hasMore !== undefined) {
        const wentBackward = args.before !== undefined

        if (data.hasMore && wentBackward && data.prevCursor) {
          console.log(`\n  prev: sevk broadcasts emails ${args.id} --before ${data.prevCursor}\n`)
        } else if (data.hasMore && !wentBackward && data.nextCursor) {
          console.log(`\n  next: sevk broadcasts emails ${args.id} --after ${data.nextCursor}\n`)
        }
      } else if (data.totalPages) {
        console.log(`\n  Page ${data.page} of ${data.totalPages} (${data.total} total)\n`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
