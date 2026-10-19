import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

interface ActiveBroadcast {
  id: string
  name: string | null
  status: string
  sentCount: number
  failedCount: number
  totalContacts: number
  scheduledAt: string | null
  abTest: { status: string, scheduledEvalAt: string | null, testPercent: number } | null
}

interface ActiveResponse {
  items: ActiveBroadcast[]
  total: number
}

export default defineCommand({
  meta: { name: 'active', description: 'List active (sending) broadcasts' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching active broadcasts...' },
        () => client.get<ActiveResponse>('/broadcasts/active')
      )

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      const items = result.items

      if (items.length === 0) {
        console.log('\n  No active broadcasts.\n')

        return
      }

      table(items, [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name', format: (v: string) => v || '-' },
        { key: 'status', label: 'Status', format: (v: string) => v === 'SENDING' ? pc.blue(v) : pc.yellow(v) },
        { key: 'sentCount', label: 'Sent', format: (v: unknown) => String(v ?? 0) },
        { key: 'failedCount', label: 'Failed', format: (v: unknown) => String(v ?? 0) },
        { key: 'totalContacts', label: 'Total', format: (v: unknown) => String(v ?? '-') },
        { key: 'scheduledAt', label: 'Scheduled', format: (v: string) => v ? new Date(v).toLocaleString() : '-' }
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
