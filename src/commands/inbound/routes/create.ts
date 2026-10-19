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
  createdAt?: string | null
}

export default defineCommand({
  meta: { name: 'create', description: 'Create an inbound forward route' },
  args: {
    ...globalArgs,
    name: { type: 'string', description: 'Route name' },
    pattern: { type: 'string', description: 'Pattern to match the recipient (e.g. support@*)' },
    target: { type: 'string', description: 'Forward target email address' },
    priority: { type: 'string', description: 'Priority (0-1000, higher runs first)', default: '0' },
    enabled: { type: 'string', description: 'Enable route: true or false', default: 'true' }
  },
  async run({ args }) {
    if (!args.name) {
      error('Name is required. Use --name.')
      process.exitCode = 1

      return
    }

    if (!args.pattern) {
      error('Pattern is required. Use --pattern.')
      process.exitCode = 1

      return
    }

    if (!args.target) {
      error('Target is required. Use --target.')
      process.exitCode = 1

      return
    }

    const enabled = parseBool(args.enabled)

    if (enabled === undefined) {
      error('Invalid --enabled. Use true or false.')
      process.exitCode = 1

      return
    }

    const priorityNum = Number(args.priority ?? 0)

    if (!Number.isInteger(priorityNum) || priorityNum < 0 || priorityNum > 1000) {
      error('Invalid --priority. Use an integer between 0 and 1000.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))

    const body: Record<string, string | number | boolean> = {
      name: String(args.name),
      pattern: String(args.pattern),
      target: String(args.target),
      priority: priorityNum,
      enabled
    }

    try {
      const route = await withSpinner(
        { start: 'Creating route...', success: 'Route created' },
        () => client.post<InboundRoute>('/inbound-settings/routes', body)
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
