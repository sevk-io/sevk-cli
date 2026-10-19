import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface CancelResponse {
  cancelledJobs?: number | null
}

export default defineCommand({
  meta: { name: 'cancel', description: 'Cancel a scheduled, starting, or sending broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' }
  },
  async run({ args }) {
    if (!args.yes && isInteractive()) {
      const confirm = await p.confirm({ message: `Cancel broadcast ${args.id}?` })

      if (p.isCancel(confirm) || !confirm) {
        return
      }
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Cancelling broadcast...', success: 'Broadcast cancelled' },
        () => client.post<CancelResponse>(`/broadcasts/${args.id}/cancel`)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        const cancelledJobs = result?.cancelledJobs ?? 0
        const drainedNote = cancelledJobs > 0
          ? `, ${cancelledJobs.toLocaleString()} queued jobs drained`
          : ''

        success(`Status: CANCELLING${drainedNote}. Final CANCELLED status posts asynchronously after background cleanup.`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
