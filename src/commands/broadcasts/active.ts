import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { table } from '~/lib/table'
import pc from 'picocolors'

export default defineCommand({
  meta: { name: 'active', description: 'List active (sending) broadcasts' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching active broadcasts...' },
        () => client.get<any>('/broadcasts/active'),
      )

      const broadcasts = result.items || result

      if (isJsonOutput(args)) {
        json(result)
        return
      }

      const items = Array.isArray(broadcasts) ? broadcasts : []

      if (items.length === 0) {
        console.log('\n  No active broadcasts.\n')
        return
      }

      table(items, [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name', format: (v: string) => v || '—' },
        { key: 'subject', label: 'Subject' },
        { key: 'status', label: 'Status', format: (v: string) => v === 'SENDING' ? pc.blue(v) : pc.yellow(v) },
        { key: 'sentAt', label: 'Started', format: (v: string) => v ? new Date(v).toLocaleString() : '—' },
      ])
      console.log()
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
