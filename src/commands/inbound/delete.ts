import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

export default defineCommand({
  meta: { name: 'delete', description: 'Delete an inbound email' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Inbound email ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Deleting inbound email...', success: 'Inbound email deleted' },
        () => client.delete<{ id: string, deleted: true }>(`/inbound/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(result ?? { id: args.id, deleted: true })
      } else {
        success('Inbound email deleted')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
