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

interface AudienceItem {
  id: string
  name: string
  contactsCount?: number
  createdAt: string
}

interface AudiencesResponse {
  items: AudienceItem[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

export default defineCommand({
  meta: { name: 'list', description: 'List audiences' },
  args: {
    ...globalArgs,
    ...paginationArgs,
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
        { start: 'Fetching audiences...' },
        () => client.get<AudiencesResponse>('/audiences', query)
      )

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      table(result.items, [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'contactsCount', label: 'Contacts', format: (v: unknown) => String(v ?? '-') },
        { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() }
      ])
      printPaginationInfo('sevk audiences list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
