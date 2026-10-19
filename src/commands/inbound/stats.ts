import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface InboundStats {
  total: number
  counts: { RECEIVED: number, PROCESSED: number, BOUNCED: number, BLOCKED: number, FAILED: number }
  received: number
  processed: number
  bounced: number
  blocked: number
  blocklistRejected: number
  spam: number
  failed: number
}

export default defineCommand({
  meta: { name: 'stats', description: 'Show inbound email stats' },
  args: {
    ...globalArgs,
    'domain-id': { type: 'string', description: 'Scope stats to a specific domain' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    const query: Record<string, string | number | boolean | undefined> = {}

    if (args['domain-id']) {
      query.domainId = args['domain-id']
    }

    try {
      const stats = await withSpinner(
        { start: 'Fetching inbound stats...' },
        () => client.get<InboundStats>('/inbound/stats', query)
      )

      if (isJsonOutput(args)) {
        json(stats)

        return
      }

      console.log()
      keyValue([
        ['Total received', String(stats.total)],
        ['Pending', String(stats.received)],
        ['Processed', String(stats.processed)],
        ['Bounced', String(stats.bounced)],
        ['Blocked', String(stats.blocked)],
        ['Spam', String(stats.spam)],
        ['Blocklist rejected this month', String(stats.blocklistRejected)],
        ['Failed', String(stats.failed)]
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
