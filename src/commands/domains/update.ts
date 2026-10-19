import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Domain {
  id: string
  domain: string
  email?: string | null
  senderName?: string | null
  clickTracking?: boolean
  openTracking?: boolean
}

export default defineCommand({
  meta: { name: 'update', description: 'Update a domain' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true },
    email: { type: 'string', description: 'Sender email address' },
    'sender-name': { type: 'string', description: 'Sender display name' },
    'click-tracking': { type: 'boolean', description: 'Enable click tracking' },
    'open-tracking': { type: 'boolean', description: 'Enable open tracking' },
    'tls-policy': { type: 'string', description: 'TLS policy: OPTIONAL or REQUIRE' },
    'inbound-enabled': { type: 'string', description: 'Enable inbound on this domain: true or false' },
    'inbound-prefix': { type: 'string', description: 'Inbound subdomain prefix; empty string uses the domain directly (mail is reserved)' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, string | boolean> = {}

    if (args['inbound-prefix'] !== undefined) {
      body.inboundPrefix = args['inbound-prefix']
    }

    if (args.email !== undefined) {
      body.email = args.email
    }

    if (args['sender-name'] !== undefined) {
      body.senderName = String(args['sender-name'])
    }

    if (args['click-tracking'] !== undefined) {
      body.clickTracking = Boolean(args['click-tracking'])
    }

    if (args['open-tracking'] !== undefined) {
      body.openTracking = Boolean(args['open-tracking'])
    }

    if (args['tls-policy'] !== undefined) {
      const v = String(args['tls-policy']).toUpperCase()

      if (v !== 'OPTIONAL' && v !== 'REQUIRE') {
        error('Invalid --tls-policy. Use OPTIONAL or REQUIRE.')
        process.exitCode = 1

        return
      }

      body.tlsPolicy = v
    }

    if (args['inbound-enabled'] !== undefined) {
      const raw = String(args['inbound-enabled']).toLowerCase()

      if (raw !== 'true' && raw !== 'false' && raw !== '1' && raw !== '0') {
        error('Invalid --inbound-enabled. Use true or false.')
        process.exitCode = 1

        return
      }

      body.inboundEnabled = raw === 'true' || raw === '1'
    }

    try {
      const result = await withSpinner(
        { start: 'Updating domain...', success: 'Domain updated' },
        () => client.put<Domain>(`/domains/${args.id}`, body)
      )

      const domain = result

      if (isJsonOutput(args)) {
        json(domain)
      } else {
        console.log()
        keyValue([
          ['ID', domain.id],
          ['Domain', domain.domain],
          ['Email', domain.email || '-'],
          ['Sender Name', domain.senderName || '-'],
          ['Click Tracking', domain.clickTracking ? 'enabled' : 'disabled'],
          ['Open Tracking', domain.openTracking ? 'enabled' : 'disabled']
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
