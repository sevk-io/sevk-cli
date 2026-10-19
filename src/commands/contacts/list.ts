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

interface Contact {
  id: string
  email: string
  subscribed: boolean
  data?: { firstName?: string, lastName?: string, [k: string]: unknown } | null
}

interface ContactListResponse {
  items: Contact[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'email', label: 'Email' },
  { key: 'firstName', label: 'First Name', format: (v: unknown) => typeof v === 'string' && v ? v : '-' },
  { key: 'lastName', label: 'Last Name', format: (v: unknown) => typeof v === 'string' && v ? v : '-' },
  { key: 'subscribed', label: 'Subscribed', format: (v: boolean) => v ? 'Yes' : 'No' }
]

const flattenItems = (items: Contact[]) =>
  items.map((c) => ({
    ...c,
    firstName: typeof c.data?.firstName === 'string' ? c.data.firstName : undefined,
    lastName: typeof c.data?.lastName === 'string' ? c.data.lastName : undefined
  }))

export default defineCommand({
  meta: { name: 'list', description: 'List contacts' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    search: { type: 'string', description: 'Search by email or data' },
    'exclude-audience': { type: 'string', description: 'Exclude contacts in this audience' },
    subscribed: { type: 'boolean', description: 'Filter by subscription state' }
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

      if (args.search) {
        q.search = args.search
      }

      if (args['exclude-audience']) {
        q.excludeAudience = args['exclude-audience']
      }

      if (args.subscribed !== undefined) {
        q.subscribed = args.subscribed
      }

      return q
    }

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching contacts...' },
          () => client.get<ContactListResponse>('/contacts', buildQuery(args))
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate({
          fetch: pagination => client.get<ContactListResponse>('/contacts', buildQuery(pagination)),
          render: (items) => table(flattenItems(items), columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<ContactListResponse>('/contacts', buildQuery(args))
      )

      table(flattenItems(result.items), columns)
      printPaginationInfo('sevk contacts list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
