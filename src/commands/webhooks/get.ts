import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'get', description: 'Get a webhook' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const webhook = await withSpinner(
        { start: 'Fetching webhook...' },
        () => client.get<any>(`/webhooks/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(webhook)
      } else {
        console.log()
        keyValue([
          ['ID', webhook.id],
          ['URL', webhook.url],
          ['Events', Array.isArray(webhook.events) ? webhook.events.join(', ') : '—'],
          ['Enabled', webhook.enabled ? 'Yes' : 'No'],
          ['Created', webhook.createdAt ? new Date(webhook.createdAt).toLocaleString() : '—'],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
