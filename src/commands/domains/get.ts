import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue, table } from '~/lib/table'
import pc from 'picocolors'

export default defineCommand({
  meta: { name: 'get', description: 'Get domain details and DNS records' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const domain = await withSpinner(
        { start: 'Fetching domain...' },
        () => client.get<any>(`/domains/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(domain)
        return
      }

      console.log()
      keyValue([
        ['ID', domain.id],
        ['Domain', domain.domain],
        ['Verified', domain.verified ? pc.green('Yes') : pc.red('No')],
        ['Region', domain.region || '—'],
        ['Created', new Date(domain.createdAt).toLocaleString()],
      ])

      if (domain.dnsRecords?.length) {
        console.log()
        console.log(pc.bold('DNS Records:'))
        table(domain.dnsRecords, [
          { key: 'type', label: 'Type' },
          { key: 'name', label: 'Name' },
          { key: 'value', label: 'Value' },
          { key: 'priority', label: 'Priority', format: (v: any) => v != null ? String(v) : '—' },
        ])
      }
      console.log()
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
