import { defineCommand } from 'citty'
import pc from 'picocolors'

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

interface InboundRoute {
  id: string
  name: string
  pattern: string
  target: string
  priority?: number | null
  enabled?: boolean | null
}

interface RouteListResponse {
  items: InboundRoute[]
  total?: number
  totalPages?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'pattern', label: 'Pattern' },
  { key: 'target', label: 'Target' },
  { key: 'priority', label: 'Priority' },
  {
    key: 'enabled',
    label: 'Enabled',
    format: (value: boolean) => value ? pc.green('Yes') : pc.red('No')
  }
]

export default defineCommand({
  meta: { name: 'list', description: 'List inbound forward routes' },
  args: {
    ...globalArgs,
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
    const fetchPage = (pagination: PaginationRequest) => {
      return client.get<RouteListResponse>(
        '/inbound-settings/routes',
        paginationQuery(pagination)
      )
    }

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching routes...' },
          () => fetchPage(args)
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate<InboundRoute>({
          fetch: fetchPage,
          render: items => table(items, columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching routes...' },
        () => fetchPage(args)
      )

      if (result.items.length === 0) {
        console.log('\n  No routes found.\n')

        return
      }

      table(result.items, columns)
      printPaginationInfo('sevk inbound routes list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
