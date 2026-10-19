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

interface Domain {
  id: string
  domain: string
  verified?: boolean
  verificationToken?: string
  region: string
  createdAt: string
}

interface ListResponse {
  items: Domain[]
  total?: number
  totalPages?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

export const buildDomainsListQuery = (
  pagination: PaginationRequest,
  verified?: boolean
): Record<string, string | number | boolean | undefined> => {
  const query = paginationQuery(pagination)

  if (verified !== undefined) {
    query.verified = String(verified)
  }

  return query
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'domain', label: 'Domain' },
  { key: 'verified', label: 'Verified', format: (v: boolean) => (v ? pc.green('Yes') : pc.red('No')) },
  { key: 'region', label: 'Region', format: (v: string) => v || pc.dim('-') },
  { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() }
]

export default defineCommand({
  meta: { name: 'list', description: 'List all domains' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    verified: { type: 'boolean', description: 'Show only DKIM-verified domains' }
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

    const buildQuery = (pagination: PaginationRequest) =>
      buildDomainsListQuery(pagination, args.verified)

    try {
      if (isJsonOutput(args)) {
        const result = await withSpinner(
          { start: 'Fetching domains...' },
          () => client.get<ListResponse>('/domains', buildQuery(args))
        )

        json(result)

        return
      }

      if (isMenuMode()) {
        await interactivePaginate<Domain>({
          fetch: pagination => client.get<ListResponse>('/domains', buildQuery(pagination)),
          render: items => table(items, columns),
          limit: Number(args.limit || 20),
          args
        })

        return
      }

      const result = await withSpinner(
        { start: 'Fetching domains...' },
        () => client.get<ListResponse>('/domains', buildQuery(args))
      )

      table(result.items, columns)
      printPaginationInfo('sevk domains list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
