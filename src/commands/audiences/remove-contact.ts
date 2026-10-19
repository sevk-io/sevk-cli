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
  meta: { name: 'remove-contact', description: 'Remove a contact from an audience' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
    'contact-id': { type: 'string', description: 'Contact ID to remove', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' }
  },
  async run({ args }) {
    if (!args.yes && isInteractive()) {
      const confirm = await p.confirm({ message: `Remove contact from audience?` })

      if (p.isCancel(confirm) || !confirm) {
        return
      }
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Removing contact...', success: 'Contact removed' },
        () => client.delete<{ audienceId: string, contactId: string, removed: true }>(
          `/audiences/${args.id}/contacts/${args['contact-id']}`
        )
      )

      if (isJsonOutput(args)) {
        json(result ?? { audienceId: args.id, contactId: args['contact-id'], removed: true })
      } else {
        success('Contact removed from audience')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
