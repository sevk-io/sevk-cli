import { defineCommand } from 'citty'

import { type ActivityAction, parseActivityActionList } from '~/lib/activity-action'
import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import type { QueryParameters } from '~/lib/client-types'
import { parseEnumFlag } from '~/lib/enum-flag'
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

const ACTIVITY_CATEGORIES = ['EMAIL', 'SUBSCRIPTION', 'all'] as const

interface ActivityItem {
  action?: string
  eventType?: string
  contactEmail?: string | null
  description?: string | null
  createdAt?: string
}

interface ActivityResponse {
  items: ActivityItem[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
  totalPages?: number
  page?: number
}

const columns = [
  { key: 'action', label: 'Action' },
  { key: 'contact', label: 'Contact' },
  { key: 'description', label: 'Description' },
  { key: 'createdAt', label: 'Date' }
]

const mapItems = (items: ActivityItem[]) => {
  return items.map((e) => ({
    action: e.action || e.eventType,
    contact: e.contactEmail || '-',
    description: e.description || '-',
    createdAt: e.createdAt ? new Date(e.createdAt).toLocaleString() : '-'
  }))
}

export default defineCommand({
  meta: { name: 'list', description: 'List project activity' },
  args: {
    ...globalArgs,
    category: { type: 'string', description: 'Filter by category (EMAIL, SUBSCRIPTION) - case sensitive' },
    type: { type: 'string', description: 'Filter by action, comma-separated (e.g. DELIVERED,OPENED,CLICKED)' },
    days: { type: 'string', description: 'Show activity from last N days' },
    search: { type: 'string', description: 'Search by email, subject, or broadcast name' },
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

    const params: {
      category?: typeof ACTIVITY_CATEGORIES[number]
      type?: ActivityAction[]
      days?: string
      search?: string
    } = {}
    let category: typeof ACTIVITY_CATEGORIES[number] | undefined
    let actions: ActivityAction[] | undefined

    try {
      category = parseEnumFlag(args.category, '--category', ACTIVITY_CATEGORIES)
      actions = args.type !== undefined ? parseActivityActionList(args.type) : undefined
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    if (category) {
      params.category = category
    }

    if (actions) {
      params.type = actions
    }

    if (args.days) {
      params.days = args.days
    }

    if (args.search) {
      params.search = args.search
    }

    const buildQuery = (pagination: PaginationRequest): QueryParameters => ({
      ...params,
      ...paginationQuery(pagination)
    })

    try {
      if (isJsonOutput(args)) {
        const data = await withSpinner(
          { start: 'Fetching activity...' },
          () => client.get<ActivityResponse>('/activity', buildQuery(args))
        )

        json(data)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate({
          fetch: pagination => client.get<ActivityResponse>('/activity', buildQuery(pagination)),
          render: (items) => {
            if (items.length === 0) {
              console.log('\n  No activity found.\n')

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
        { start: 'Fetching activity...' },
        () => client.get<ActivityResponse>('/activity', buildQuery(args))
      )
      const items = data.items

      if (items.length === 0) {
        console.log('\n  No activity found.\n')

        return
      }

      console.log()
      table(mapItems(items), columns)
      if (data.hasMore !== undefined) {
        // Direction-aware hint: walking backward (--before X) should
        // continue with --before prevCursor, not --after nextCursor.
        const wentBackward = args.before !== undefined

        if (data.hasMore && wentBackward && data.prevCursor) {
          console.log(`\n  prev: sevk activity list --before ${data.prevCursor}\n`)
        } else if (data.hasMore && !wentBackward && data.nextCursor) {
          console.log(`\n  next: sevk activity list --after ${data.nextCursor}\n`)
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
