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
import type { SegmentGroup, SegmentRule } from '~/lib/segment-input'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

interface Segment {
  id: string
  name: string
  operator: string
  rules: SegmentRule[]
  limitToTopics: string[]
  groups: SegmentGroup[] | null
  lastRunAt: string | null
  lastRunCount: number | null
  createdAt: string
  updatedAt: string
}

interface SegmentListResponse {
  items: Segment[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

export default defineCommand({
  meta: { name: 'list', description: 'List segments in an audience' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    search: { type: 'string', description: 'Search by name' }
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
        { start: 'Fetching segments...' },
        () => client.get<SegmentListResponse>(`/audiences/${args['audience-id']}/segments`, query)
      )

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      table(result.items, [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'operator', label: 'Op' },
        { key: 'rules', label: 'Rules', format: (v: unknown) => String(Array.isArray(v) ? v.length : 0) },
        { key: 'lastRunCount', label: 'Last count', format: (v: unknown) => v == null ? '-' : String(v) },
        { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() }
      ])
      printPaginationInfo('sevk segments list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
