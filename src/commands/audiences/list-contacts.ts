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
  subscribed?: boolean
  data?: Record<string, unknown> | null
}

interface FlatContact extends Contact {
  firstName?: string
  lastName?: string
}

interface ContactsResponse {
  items: Contact[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'email', label: 'Email' },
  { key: 'firstName', label: 'First Name', format: (v: string) => v || '-' },
  { key: 'lastName', label: 'Last Name', format: (v: string) => v || '-' },
  { key: 'subscribed', label: 'Subscribed', format: (v: boolean) => v ? 'Yes' : 'No' }
]

const flattenItems = (items: Contact[]): FlatContact[] =>
  items.map((c) => ({
    ...c,
    firstName: typeof c.data?.firstName === 'string' ? c.data.firstName : undefined,
    lastName: typeof c.data?.lastName === 'string' ? c.data.lastName : undefined
  }))

export default defineCommand({
  meta: { name: 'list-contacts', description: 'List contacts in an audience' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
    search: { type: 'string', description: 'Search by email or data' },
    subscribed: { type: 'boolean', description: 'Filter by subscription state' },
    'exclude-topic-id': { type: 'string', description: 'Exclude contacts already in this topic' }
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

    const buildQuery = (pagination: PaginationRequest): Record<string, string | number | boolean | undefined> => {
      const q = paginationQuery(pagination)

      if (args.search) {
        q.search = args.search
      }

      if (args.subscribed !== undefined) {
        q.subscribed = args.subscribed
      }

      if (args['exclude-topic-id']) {
        q.excludeTopicId = args['exclude-topic-id']
      }

      return q
    }

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching contacts...' },
          () => client.get<ContactsResponse>(`/audiences/${args.id}/contacts`, buildQuery(args))
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate({
          fetch: pagination => client.get<ContactsResponse>(`/audiences/${args.id}/contacts`, buildQuery(pagination)),
          render: (items) => table(flattenItems(items), columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<ContactsResponse>(`/audiences/${args.id}/contacts`, buildQuery(args))
      )

      table(flattenItems(result.items), columns)
      printPaginationInfo(`sevk audiences list-contacts ${args.id}`, args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
