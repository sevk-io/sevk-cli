import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { parseBool } from '~/lib/parse'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface InboundRoute {
  id: string
  name: string
  pattern: string
  target: string
  priority?: number | null
  enabled?: boolean | null
}

export default defineCommand({
  meta: { name: 'update', description: 'Update an inbound forward route' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Route ID', required: true },
    name: { type: 'string', description: 'Route name' },
    pattern: { type: 'string', description: 'Pattern to match the recipient' },
    target: { type: 'string', description: 'Forward target email address' },
    priority: { type: 'string', description: 'Priority (0-1000)' },
    enabled: { type: 'string', description: 'Enable/disable route: true or false' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    const body: Record<string, string | number | boolean> = {}

    if (args.name !== undefined) {
      body.name = args.name
    }

    if (args.pattern !== undefined) {
      body.pattern = args.pattern
    }

    if (args.target !== undefined) {
      body.target = args.target
    }

    if (args.priority !== undefined) {
      const priorityNum = Number(args.priority)

      if (!Number.isInteger(priorityNum) || priorityNum < 0 || priorityNum > 1000) {
        error('Invalid --priority. Use an integer between 0 and 1000.')
        process.exitCode = 1

        return
      }

      body.priority = priorityNum
    }

    if (args.enabled !== undefined) {
      const enabled = parseBool(args.enabled)

      if (enabled === undefined) {
        error('Invalid --enabled. Use true or false.')
        process.exitCode = 1

        return
      }

      body.enabled = enabled
    }

    try {
      const route = await withSpinner(
        { start: 'Updating route...', success: 'Route updated' },
        () => client.put<InboundRoute>(`/inbound-settings/routes/${args.id}`, body)
      )

      if (isJsonOutput(args)) {
        json(route)
      } else {
        console.log()
        keyValue([
          ['ID', route.id],
          ['Name', route.name],
          ['Pattern', route.pattern],
          ['Target', route.target],
          ['Priority', String(route.priority ?? 0)],
          ['Enabled', route.enabled ? pc.green('Yes') : pc.red('No')]
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
