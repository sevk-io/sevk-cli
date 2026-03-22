import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'events', description: 'List available webhook event types' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching events...' },
        () => client.get<any>('/webhooks/events'),
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        const events = data.items || []
        console.log()
        console.log('  Available webhook events:')
        console.log()
        for (const event of events) {
          console.log(`    ${event}`)
        }
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
