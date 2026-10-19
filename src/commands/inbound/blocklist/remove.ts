import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

export default defineCommand({
  meta: { name: 'remove', description: 'Remove an entry from the inbound blocklist' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Blocklist entry ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Removing blocklist entry...', success: 'Blocklist entry removed' },
        () => client.delete<{ id: string, deleted: true }>(`/inbound-settings/blocklist/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(result ?? { id: args.id, deleted: true })
      } else {
        success('Blocklist entry removed')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
