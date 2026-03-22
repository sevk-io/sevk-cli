import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'get', description: 'Get segment details' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Segment ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const segment = await withSpinner(
        { start: 'Fetching segment...' },
        () => client.get<any>(`/audiences/${args['audience-id']}/segments/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(segment)
      } else {
        console.log()
        keyValue([
          ['ID', segment.id],
          ['Name', segment.name],
          ['Created', new Date(segment.createdAt).toLocaleString()],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
