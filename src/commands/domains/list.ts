import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { table } from '~/lib/table'
import pc from 'picocolors'

export default defineCommand({
  meta: { name: 'list', description: 'List all domains' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching domains...' },
        () => client.get<any>('/domains'),
      )

      const domains = result.items || result

      if (isJsonOutput(args)) {
        json(domains)
        return
      }

      table(Array.isArray(domains) ? domains : [], [
        { key: 'id', label: 'ID' },
        { key: 'domain', label: 'Domain' },
        { key: 'verified', label: 'Verified', format: (v: boolean) => (v ? pc.green('Yes') : pc.red('No')) },
        { key: 'region', label: 'Region', format: (v: string) => v || pc.dim('—') },
        { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() },
      ])
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
