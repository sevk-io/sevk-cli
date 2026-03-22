import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'get', description: 'Get audience details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const audience = await withSpinner(
        { start: 'Fetching audience...' },
        () => client.get<any>(`/audiences/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(audience)
      } else {
        console.log()
        keyValue([
          ['ID', audience.id],
          ['Name', audience.name],
          ['Contacts', String(audience._count?.contacts ?? '—')],
          ['Created', new Date(audience.createdAt).toLocaleString()],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
