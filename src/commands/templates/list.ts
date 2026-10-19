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

interface Template {
  id: string
  title: string
  style?: string | null
  createdAt: string
}

interface ListResponse {
  items: Template[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'style', label: 'Style', format: (v: string) => v || '-' },
  { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() }
]

export default defineCommand({
  meta: { name: 'list', description: 'List templates' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    search: { type: 'string', description: 'Search by title or content' }
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

      return q
    }

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching templates...' },
          () => client.get<ListResponse>('/templates', buildQuery(args))
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate<Template>({
          fetch: pagination => client.get<ListResponse>('/templates', buildQuery(pagination)),
          render: (items) => table(items, columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching templates...' },
        () => client.get<ListResponse>('/templates', buildQuery(args))
      )

      table(result.items, columns)
      printPaginationInfo('sevk templates list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
