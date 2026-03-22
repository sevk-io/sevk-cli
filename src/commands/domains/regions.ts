import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { table } from '~/lib/table'

export default defineCommand({
  meta: { name: 'regions', description: 'List available AWS SES regions' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching regions...' },
        () => client.get<any>('/domains/regions'),
      )

      const regions = result.items || result

      if (isJsonOutput(args)) {
        json(regions)
        return
      }

      if (Array.isArray(regions)) {
        table(regions.map((r: string) => ({ region: r })), [
          { key: 'region', label: 'Region' },
        ])
      } else {
        json(regions)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
