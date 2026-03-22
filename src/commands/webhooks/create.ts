import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'create', description: 'Create a webhook' },
  args: {
    ...globalArgs,
    url: { type: 'string', description: 'Webhook URL' },
    events: { type: 'string', description: 'Comma-separated event types (e.g. email.sent,email.delivered)' },
    enabled: { type: 'string', description: 'Enable webhook (true/false)', default: 'true' },
  },
  async run({ args }) {
    let url = args.url
    let events = args.events

    if (!url && isInteractive()) {
      const result = await p.text({
        message: 'Webhook URL',
        placeholder: 'https://example.com/webhook',
        validate: (v) => (!v ? 'Required' : undefined),
      })
      if (p.isCancel(result)) return
      url = result
    }

    if (!url) {
      error('URL is required. Use --url.')
      process.exitCode = 1; return
    }

    if (!events && isInteractive()) {
      const result = await p.text({
        message: 'Events (comma-separated)',
        placeholder: 'email.sent,email.delivered,email.opened',
        validate: (v) => (!v ? 'Required' : undefined),
      })
      if (p.isCancel(result)) return
      events = result
    }

    if (!events) {
      error('Events are required. Use --events.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const webhook = await withSpinner(
        { start: 'Creating webhook...', success: 'Webhook created' },
        () => client.post<any>('/webhooks', {
          url,
          events: events!.split(',').map(e => e.trim()),
          enabled: args.enabled !== 'false',
        }),
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
          ['Secret', webhook.secret || '—'],
        ])
        console.log()
        if (webhook.secret) {
          console.log('  Save the secret — it will not be shown again.')
          console.log()
        }
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
