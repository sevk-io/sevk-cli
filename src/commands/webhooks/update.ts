import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'update', description: 'Update a webhook' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true },
    url: { type: 'string', description: 'Webhook URL' },
    events: { type: 'string', description: 'Comma-separated event types' },
    enabled: { type: 'string', description: 'Enable/disable webhook (true/false)' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = {}

    if (args.url) body.url = args.url
    if (args.events) body.events = args.events.split(',').map(e => e.trim())
    if (args.enabled !== undefined) body.enabled = args.enabled === 'true'

    if (Object.keys(body).length === 0) {
      error('No fields to update. Use --url, --events, or --enabled.')
      process.exitCode = 1; return
    }

    try {
      const webhook = await withSpinner(
        { start: 'Updating webhook...', success: 'Webhook updated' },
        () => client.put<any>(`/webhooks/${args.id}`, body),
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
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
