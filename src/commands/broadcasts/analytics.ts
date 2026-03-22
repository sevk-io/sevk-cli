import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'analytics', description: 'Get broadcast analytics' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching analytics...' },
        () => client.get<any>(`/broadcasts/${args.id}/analytics`),
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        console.log()
        keyValue([
          ['Total', String(data.total ?? '—')],
          ['Sent', String(data.sent ?? '—')],
          ['Delivered', String(data.delivered ?? '—')],
          ['Opened', String(data.opened ?? '—')],
          ['Clicked', String(data.clicked ?? '—')],
          ['Bounced', String(data.bounced ?? '—')],
          ['Complained', String(data.complained ?? '—')],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
