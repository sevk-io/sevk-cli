import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { parseBooleanFlag } from '~/lib/boolean-flag'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'
import { parseWebhookEventList } from '~/lib/webhook-event'

interface Webhook {
  id: string
  url: string
  events: string[]
  enabled: boolean
  secret: string | null
  failureCount: number
  lastFailureAt: string | null
  lastDeliveryAt: string | null
  disabledAt: string | null
  projectId: string
  createdAt: string
  updatedAt: string
}

export default defineCommand({
  meta: { name: 'update', description: 'Update a webhook' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true },
    url: { type: 'string', description: 'Webhook URL' },
    events: { type: 'string', description: 'Comma-separated event types' },
    enabled: { type: 'string', description: 'Enable/disable webhook: true or false' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, string | string[] | boolean> = {}

    if (args.url !== undefined) {
      body.url = args.url
    }

    try {
      if (args.events !== undefined) {
        body.events = parseWebhookEventList(args.events)
      }

      if (args.enabled !== undefined) {
        body.enabled = parseBooleanFlag(args.enabled, '--enabled')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    try {
      const webhook = await withSpinner(
        { start: 'Updating webhook...', success: 'Webhook updated' },
        () => client.put<Webhook>(`/webhooks/${args.id}`, body)
      )

      if (isJsonOutput(args)) {
        json(webhook)
      } else {
        console.log()
        keyValue([
          ['ID', webhook.id],
          ['URL', webhook.url],
          ['Events', Array.isArray(webhook.events) ? webhook.events.join(', ') : '-'],
          ['Enabled', webhook.enabled ? 'Yes' : 'No']
        ])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
