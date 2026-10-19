import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { table } from '~/lib/table'

export default defineCommand({
  meta: { name: 'regions', description: 'List available AWS SES regions' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching regions...' },
        () => client.get<{ items: string[] }>('/domains/regions')
      )

      const regions = result.items

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      table(regions.map((r) => ({ region: r })), [
        { key: 'region', label: 'Region' }
      ])
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
