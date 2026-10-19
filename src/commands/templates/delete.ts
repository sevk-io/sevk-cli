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
  meta: { name: 'delete', description: 'Delete a template' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Template ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' }
  },
  async run({ args }) {
    if (!args.yes && isInteractive()) {
      const confirm = await p.confirm({ message: `Delete template ${args.id}?` })

      if (p.isCancel(confirm) || !confirm) {
        return
      }
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Deleting template...', success: 'Template deleted' },
        () => client.delete<{ id: string, deleted: true }>(`/templates/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(result ?? { id: args.id, deleted: true })
      } else {
        success('Template deleted')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
