import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

interface DnsRecord {
  type: string
  name: string
  value: string
}

export default defineCommand({
  meta: { name: 'dns-records', description: 'Get DNS records for a domain' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching DNS records...' },
        () => client.get<{ items: DnsRecord[] }>(`/domains/${args.id}/dns-records`)
      )

      const records = result.items

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      if (records.length === 0) {
        console.log('No DNS records found.')

        return
      }

      const rows = records.map(r => {
        if (r.type === 'MX') {
          const match = r.value.match(/^(\d+)\s+(.+)$/)

          if (match) {
            return { type: r.type, name: r.name, priority: match[1], value: match[2] }
          }
        }

        return { type: r.type, name: r.name, priority: '-', value: r.value }
      })

      console.log()
      table(rows, [
        { key: 'type', label: 'Type' },
        { key: 'name', label: 'Name' },
        { key: 'priority', label: 'Priority' },
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
