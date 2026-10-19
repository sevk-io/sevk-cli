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

interface BlocklistEntry {
  id: string
  type: string
  value: string
  reason?: string | null
  createdAt?: string | null
}

interface BlocklistListResponse {
  items: BlocklistEntry[]
  total?: number
  totalPages?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Type' },
  { key: 'value', label: 'Value' },
  { key: 'reason', label: 'Reason', format: (value: string) => value || '-' },
  {
    key: 'createdAt',
    label: 'Created',
    format: (value: string) => value ? new Date(value).toLocaleDateString() : '-'
  }
]

export default defineCommand({
  meta: { name: 'list', description: 'List inbound blocklist entries' },
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
      return client.get<BlocklistListResponse>(
        '/inbound-settings/blocklist',
        paginationQuery(pagination)
      )
    }

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching blocklist...' },
          () => fetchPage(args)
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate<BlocklistEntry>({
          fetch: fetchPage,
          render: items => table(items, columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching blocklist...' },
        () => fetchPage(args)
      )

      if (result.items.length === 0) {
        console.log('\n  No blocklist entries found.\n')

        return
      }

      table(result.items, columns)
      printPaginationInfo('sevk inbound blocklist list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
