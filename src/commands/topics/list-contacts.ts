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

interface TopicContact {
  id: string
  email: string
  subscribed: boolean
  createdAt?: string | null
}

interface ListResponse {
  items: TopicContact[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'email', label: 'Email' },
  { key: 'subscribed', label: 'Subscribed', format: (v: boolean) => v ? 'Yes' : 'No' },
  { key: 'createdAt', label: 'Added', format: (v: string) => v ? new Date(v).toLocaleDateString() : '-' }
]

export default defineCommand({
  meta: { name: 'list-contacts', description: 'List contacts in a topic' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    id: { type: 'positional', description: 'Topic ID', required: true },
    search: { type: 'string', description: 'Search by contact email or data' },
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
    const endpoint = `/topics/${args.id}/contacts`

    const buildQuery = (pagination: PaginationRequest) => {
      const q = paginationQuery(pagination)

      if (args.search) {
        q.search = args.search
      }

      if (args.subscribed !== undefined) {
        q.subscribed = args.subscribed
      }

      return q
    }

    try {
      if (isJsonOutput(args)) {
        const data = await withSpinner(
          { start: 'Fetching contacts...' },
          () => client.get<ListResponse>(endpoint, buildQuery(args))
        )

        json(data)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate<TopicContact>({
          fetch: pagination => client.get<ListResponse>(endpoint, buildQuery(pagination)),
          render: (items) => {
            if (items.length === 0) {
              console.log('\n  No contacts in this topic.\n')

              return
            }

            table(items, columns)
          },
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const data = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<ListResponse>(endpoint, buildQuery(args))
      )
      const items = data.items

      if (items.length === 0) {
        console.log('\n  No contacts in this topic.\n')

        return
      }

      table(items, columns)
      printPaginationInfo(`sevk topics list-contacts ${args.id}`, args, data)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
