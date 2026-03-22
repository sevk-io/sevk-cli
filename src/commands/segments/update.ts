import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'update', description: 'Update a segment' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Segment ID', required: true },
    name: { type: 'string', description: 'Segment name' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = {}

    if (args.name) body.name = args.name

    if (Object.keys(body).length === 0) {
      error('Nothing to update. Provide at least one field.')
      process.exitCode = 1; return
    }

    try {
      const segment = await withSpinner(
        { start: 'Updating segment...', success: 'Segment updated' },
        () => client.put<any>(`/audiences/${args['audience-id']}/segments/${args.id}`, body),
      )

      if (isJsonOutput(args)) {
        json(segment)
      } else {
        success('Segment updated')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
