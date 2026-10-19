import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface MutationResponse {
  id: string
}

export default defineCommand({
  meta: { name: 'cancel', description: 'Cancel a scheduled email' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Email ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Cancelling email...', success: 'Email cancelled' },
        () => client.post<MutationResponse>(`/emails/${args.id}/cancel`)
      )

      if (isJsonOutput(args)) json(result)
      else success(`Email cancelled (${result.id})`)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1
    }
  }
})
