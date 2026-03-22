import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'update', description: 'Update a domain' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true },
    email: { type: 'string', description: 'Sender email address' },
    from: { type: 'string', description: 'From header value' },
    'sender-name': { type: 'string', description: 'Sender display name' },
    'click-tracking': { type: 'string', description: 'Enable click tracking (true/false)' },
    'open-tracking': { type: 'string', description: 'Enable open tracking (true/false)' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = {}

    if (args.email) body.email = args.email
    if (args.from) body.from = args.from
    if (args['sender-name']) body.senderName = args['sender-name']
    if (args['click-tracking'] !== undefined) body.clickTracking = args['click-tracking'] === 'true'
    if (args['open-tracking'] !== undefined) body.openTracking = args['open-tracking'] === 'true'

    if (Object.keys(body).length === 0) {
      error('No fields to update. Use --email, --from, --sender-name, --click-tracking, or --open-tracking.')
      process.exitCode = 1; return
    }

    try {
      const result = await withSpinner(
        { start: 'Updating domain...', success: 'Domain updated' },
        () => client.put<any>(`/domains/${args.id}`, body),
      )

      const domain = result

      if (isJsonOutput(args)) {
        json(domain)
      } else {
        console.log()
        keyValue([
          ['ID', domain.id],
          ['Domain', domain.domain],
          ['Email', domain.email || '—'],
          ['From', domain.from || '—'],
          ['Sender Name', domain.senderName || '—'],
          ['Click Tracking', domain.clickTracking ? 'enabled' : 'disabled'],
          ['Open Tracking', domain.openTracking ? 'enabled' : 'disabled'],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
