import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue, table } from '~/lib/table'

interface Domain {
  id: string
  domain: string
  email: string
  senderName?: string | null
  region: string
  verified?: boolean
  verificationToken?: string
  clickTracking?: boolean
  openTracking?: boolean
  tlsPolicy?: string | null
  inboundEnabled?: boolean
  inboundVerified?: boolean
  inboundPrefix: string
  createdAt: string
  dnsRecords?: { type: string, name: string, value: string }[]
}

export default defineCommand({
  meta: { name: 'get', description: 'Get domain details and DNS records' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const domain = await withSpinner(
        { start: 'Fetching domain...' },
        () => client.get<Domain>(`/domains/${args.id}`)
      )

      const dnsRecords: Array<{ type: string, name: string, value: string }> = domain.dnsRecords || []

      if (isJsonOutput(args)) {
        json(domain)

        return
      }

      console.log()
      keyValue([
        ['ID', domain.id],
        ['Domain', domain.domain],
        ['Email', domain.email],
        ['Sender name', domain.senderName || '-'],
        ['Region', domain.region],
        ['Verified', domain.verified ? pc.green('Yes') : pc.red('No')],
        ['Click tracking', domain.clickTracking ? pc.green('On') : pc.dim('Off')],
        ['Open tracking', domain.openTracking ? pc.green('On') : pc.dim('Off')],
        ['TLS policy', domain.tlsPolicy || 'OPTIONAL'],
        ['Inbound prefix', domain.inboundPrefix || '(none)'],
        ['Inbound enabled', domain.inboundEnabled ? pc.green('Yes') : pc.red('No')],
        ['Inbound verified', domain.inboundVerified ? pc.green('Yes') : pc.red('No')],
        ['Created', new Date(domain.createdAt).toLocaleString()]
      ])

      console.log()
      console.log(pc.bold('DNS records'))
      table(dnsRecords, [
        { key: 'type', label: 'Type' },
        { key: 'name', label: 'Name' },
        { key: 'value', label: 'Value' }
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
