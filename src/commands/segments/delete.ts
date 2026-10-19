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

export default defineCommand({
  meta: { name: 'delete', description: 'Delete a segment' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Segment ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' }
  },
  async run({ args }) {
    if (!args.yes && isInteractive()) {
      const confirm = await p.confirm({ message: `Delete segment ${args.id}?` })

      if (p.isCancel(confirm) || !confirm) {
        return
      }
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Deleting segment...', success: 'Segment deleted' },
        () => client.delete<{ id: string, deleted: true }>(`/segments/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(result ?? { id: args.id, deleted: true })
      } else {
        success('Segment deleted')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
