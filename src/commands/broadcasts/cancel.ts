import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'cancel', description: 'Cancel a scheduled broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' },
  },
  async run({ args }) {
    if (!args.yes && isInteractive()) {
      const confirm = await p.confirm({ message: `Cancel broadcast ${args.id}?` })
      if (p.isCancel(confirm) || !confirm) return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Cancelling broadcast...', success: 'Broadcast cancelled' },
        () => client.post<any>(`/broadcasts/${args.id}/cancel`),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success('Broadcast cancelled')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
