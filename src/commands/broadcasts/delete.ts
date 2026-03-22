import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'delete', description: 'Delete a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' },
  },
  async run({ args }) {
    if (!args.yes && isInteractive()) {
      const confirm = await p.confirm({ message: `Delete broadcast ${args.id}?` })
      if (p.isCancel(confirm) || !confirm) return
    }

    const client = await createClient(getClientOpts(args))

    try {
      await withSpinner(
        { start: 'Deleting broadcast...', success: 'Broadcast deleted' },
        () => client.delete(`/broadcasts/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json({ deleted: true, id: args.id })
      } else {
        success('Broadcast deleted')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
