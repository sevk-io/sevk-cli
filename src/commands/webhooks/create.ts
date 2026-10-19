import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { parseBooleanFlag } from '~/lib/boolean-flag'
import { createClient } from '~/lib/client'
import {
  error,
  isInteractive,
  json
} from '~/lib/output'
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
  meta: { name: 'create', description: 'Create a webhook' },
  args: {
    ...globalArgs,
    url: { type: 'string', description: 'Webhook URL' },
    events: { type: 'string', description: 'Comma-separated event types (e.g. email.sent,email.delivered)' },
    enabled: { type: 'string', description: 'Enable webhook (true/false)', default: 'true' }
  },
  async run({ args }) {
    let url = args.url
    let events = args.events

    if (!url && isInteractive()) {
      const result = await p.text({
        message: 'Webhook URL',
        placeholder: 'https://example.com/webhook',
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      url = result
    }

    if (!url) {
      error('URL is required. Use --url.')
      process.exitCode = 1

      return
    }

    if (!events && isInteractive()) {
      const result = await p.text({
        message: 'Events (comma-separated)',
        placeholder: 'email.sent,email.delivered,email.opened',
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      events = result
    }

    if (!events) {
      error('Events are required. Use --events.')
      process.exitCode = 1

      return
    }

    let eventList: ReturnType<typeof parseWebhookEventList>
    let enabled: boolean | undefined

    try {
      eventList = parseWebhookEventList(events)
      enabled = parseBooleanFlag(args.enabled, '--enabled')
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
    const client = await createClient(getClientOpts(args))

    try {
      const webhook = await withSpinner(
        { start: 'Creating webhook...', success: 'Webhook created' },
        () => client.post<Webhook>('/webhooks', {
          url,
          events: eventList,
          enabled: enabled ?? true
        })
      )

      if (isJsonOutput(args)) {
        json(webhook)
      } else {
        console.log()
        keyValue([
          ['ID', webhook.id],
          ['URL', webhook.url],
          ['Events', Array.isArray(webhook.events) ? webhook.events.join(', ') : '-'],
          ['Enabled', webhook.enabled ? 'Yes' : 'No'],
          ['Secret', webhook.secret || '-']
        ])
        console.log()
        if (webhook.secret) {
          console.log('  Save the secret - it will not be shown again.')
          console.log()
        }
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
