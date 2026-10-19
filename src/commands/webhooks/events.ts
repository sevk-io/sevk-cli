import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface WebhookEventsResponse {
  items: string[]
  events: Record<string, { name: string, description: string, category: string }>
}

export default defineCommand({
  meta: { name: 'events', description: 'List available webhook event types' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching events...' },
        () => client.get<WebhookEventsResponse>('/webhooks/events')
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        const events = data.items

        console.log()
        console.log('  Available webhook events:')
        console.log()
        for (const event of events) {
          console.log(`    ${event}`)
        }

        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
