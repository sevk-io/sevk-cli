import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

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
  meta: { name: 'get', description: 'Get a webhook' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const webhook = await withSpinner(
        { start: 'Fetching webhook...' },
        () => client.get<Webhook>(`/webhooks/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(webhook)
      } else {
        const fmtDate = (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : '-')
        const rows: [string, string][] = [
          ['ID', webhook.id],
          ['URL', webhook.url],
          ['Events', Array.isArray(webhook.events) ? webhook.events.join(', ') : '-'],
          ['Enabled', webhook.enabled ? 'Yes' : 'No']
        ]

        if (webhook.failureCount !== undefined && webhook.failureCount !== null) {
          rows.push(['Failure count', String(webhook.failureCount)])
        }

        if ('lastFailureAt' in webhook) {
          rows.push(['Last failure', fmtDate(webhook.lastFailureAt)])
        }

        if ('lastDeliveryAt' in webhook) {
          rows.push(['Last delivery', fmtDate(webhook.lastDeliveryAt)])
        }

        if ('disabledAt' in webhook) {
          rows.push(['Disabled at', fmtDate(webhook.disabledAt)])
        }

        rows.push(['Created', fmtDate(webhook.createdAt)])

        console.log()
        keyValue(rows)
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
