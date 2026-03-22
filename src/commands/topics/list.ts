import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { table } from '~/lib/table'

export default defineCommand({
  meta: { name: 'list', description: 'List topics in an audience' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching topics...' },
        () => client.get<any>(`/audiences/${args['audience-id']}/topics`),
      )

      const topics = result.items || result

      if (isJsonOutput(args)) {
        json(topics)
        return
      }

      table(Array.isArray(topics) ? topics : [], [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() },
      ])
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
