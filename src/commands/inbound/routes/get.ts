import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface InboundRoute {
  id: string
  name: string
  pattern: string
  target: string
  priority?: number | null
  enabled?: boolean | null
  createdAt?: string | null
}

export default defineCommand({
  meta: { name: 'get', description: 'Get an inbound forward route' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Route ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const route = await withSpinner(
        { start: 'Fetching route...' },
        () => client.get<InboundRoute>(`/inbound-settings/routes/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(route)

        return
      }

      console.log()
      keyValue([
        ['ID', route.id],
        ['Name', route.name],
        ['Pattern', route.pattern],
        ['Target', route.target],
        ['Priority', String(route.priority ?? 0)],
        ['Enabled', route.enabled ? pc.green('Yes') : pc.red('No')],
        ['Created', route.createdAt ? new Date(route.createdAt).toLocaleString() : '-']
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
