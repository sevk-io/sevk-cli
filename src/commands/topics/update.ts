import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'update', description: 'Update a topic' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Topic ID', required: true },
    name: { type: 'string', description: 'New name' },
  },
  async run({ args }) {
    if (!args.name) {
      error('Provide --name to update.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const topic = await withSpinner(
        { start: 'Updating topic...', success: 'Topic updated' },
        () => client.put<any>(`/audiences/${args['audience-id']}/topics/${args.id}`, { name: args.name }),
      )

      if (isJsonOutput(args)) {
        json(topic)
      } else {
        success('Topic updated')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
