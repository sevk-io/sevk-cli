import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import {
  assertCursorExclusive,
  paginationArgs,
  paginationQuery,
  printPaginationInfo
} from '~/lib/pagination'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

interface Topic {
  id: string
  name: string
  createdAt: string
}

interface ListResponse {
  items: Topic[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

export default defineCommand({
  meta: { name: 'list', description: 'List topics in an audience' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    search: { type: 'string', description: 'Search by name or description' }
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

    const query = paginationQuery(args)

    if (args.search) {
      query.search = args.search
    }

    try {
      const result = await withSpinner(
        { start: 'Fetching topics...' },
        () => client.get<ListResponse>(`/audiences/${args['audience-id']}/topics`, query)
      )

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      table(result.items, [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() }
      ])
      printPaginationInfo('sevk topics list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
