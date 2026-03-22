import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'get', description: 'Get topic details' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Topic ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const topic = await withSpinner(
        { start: 'Fetching topic...' },
        () => client.get<any>(`/audiences/${args['audience-id']}/topics/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(topic)
      } else {
        console.log()
        keyValue([
          ['ID', topic.id],
          ['Name', topic.name],
          ['Created', new Date(topic.createdAt).toLocaleString()],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
