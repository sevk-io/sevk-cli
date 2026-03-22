import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'calculate', description: 'Calculate segment size' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Segment ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Calculating segment size...' },
        () => client.get<any>(`/audiences/${args['audience-id']}/segments/${args.id}/calculate`),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`Segment contains ${result.count ?? result.total ?? JSON.stringify(result)} contacts`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
