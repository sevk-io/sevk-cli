import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import { error, json } from '~/lib/output'
import {
  assertCursorExclusive,
  paginationArgs,
  paginationQuery,
  printPaginationInfo
} from '~/lib/pagination'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

const INBOUND_STATUSES = ['RECEIVED', 'PROCESSED', 'BOUNCED', 'BLOCKED', 'FAILED'] as const

interface InboundListItem {
  id: string
  fromAddress: string
  toAddress: string
  subject?: string | null
  status: string
  receivedAt?: string | null
}

interface InboundListResponse {
  items?: InboundListItem[]
  total?: number
  hasMore?: boolean
  nextCursor?: string | null
  prevCursor?: string | null
}

export default defineCommand({
  meta: { name: 'list', description: 'List inbound emails' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    status: { type: 'string', description: `Filter by status (${INBOUND_STATUSES.join('|')})` },
    'domain-id': { type: 'string', description: 'Filter by domain id' },
    search: { type: 'string', description: 'Search across from, to and subject' },
    'broadcast-id': { type: 'string', description: 'Only replies to this broadcast' },
    'is-spam': { type: 'boolean', description: 'Filter by spam flag (--no-is-spam for unflagged)' },
    'is-virus': { type: 'boolean', description: 'Filter by virus flag (--no-is-virus for unflagged)' }
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

    if (args.status !== undefined) {
      try {
        query.status = parseEnumFlag(args.status, '--status', INBOUND_STATUSES, {
          uppercase: true
        })
      } catch (err: unknown) {
        error(err)
        process.exitCode = 1

        return
      }
    }

    if (args['domain-id']) {
      query.domainId = args['domain-id']
    }

    if (args['broadcast-id']) {
      query.broadcastId = args['broadcast-id']
    }

    if (args.search) {
      query.search = args.search
    }

    if (args['is-spam'] !== undefined) {
      query.isSpam = args['is-spam']
    }

    if (args['is-virus'] !== undefined) {
      query.isVirus = args['is-virus']
    }

    try {
      const result = await withSpinner(
        { start: 'Fetching inbound emails...' },
        () => client.get<InboundListResponse>('/inbound', query)
      )

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      const items = result.items || []

      if (items.length === 0) {
        console.log('\n  No inbound emails found.\n')

        return
      }

      table(items, [
        { key: 'id', label: 'ID' },
        { key: 'fromAddress', label: 'From' },
        { key: 'toAddress', label: 'To' },
        { key: 'subject', label: 'Subject', format: (v: string) => v || pc.dim('(no subject)') },
        { key: 'status', label: 'Status' },
        { key: 'receivedAt', label: 'Received', format: (v: string) => v ? new Date(v).toLocaleString() : '-' }
      ])

      printPaginationInfo('sevk inbound list', args, result)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
