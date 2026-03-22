import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { table } from '~/lib/table'

export default defineCommand({
  meta: { name: 'dns-records', description: 'Get DNS records for a domain' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching DNS records...' },
        () => client.get<any>(`/domains/${args.id}/dns-records`),
      )

      const records = result.items || result

      if (isJsonOutput(args)) {
        json(records)
        return
      }

      if (!Array.isArray(records) || records.length === 0) {
        console.log('No DNS records found.')
        return
      }

      console.log()
      table(records, [
        { key: 'type', label: 'Type' },
        { key: 'name', label: 'Key' },
        { key: 'priority', label: 'Priority', format: (v: any) => v != null ? String(v) : '—' },
        { key: 'value', label: 'Value' },
      ])
      console.log()
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
