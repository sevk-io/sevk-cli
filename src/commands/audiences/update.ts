import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'update', description: 'Update an audience' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
    name: { type: 'string', description: 'New name' },
  },
  async run({ args }) {
    if (!args.name) {
      error('Provide --name to update.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const audience = await withSpinner(
        { start: 'Updating audience...', success: 'Audience updated' },
        () => client.put<any>(`/audiences/${args.id}`, { name: args.name }),
      )

      if (isJsonOutput(args)) {
        json(audience)
      } else {
        success('Audience updated')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
