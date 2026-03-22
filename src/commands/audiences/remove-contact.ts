import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'remove-contact', description: 'Remove a contact from an audience' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
    'contact-id': { type: 'string', description: 'Contact ID to remove', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' },
  },
  async run({ args }) {
    if (!args.yes && isInteractive()) {
      const confirm = await p.confirm({ message: `Remove contact from audience?` })
      if (p.isCancel(confirm) || !confirm) return
    }

    const client = await createClient(getClientOpts(args))

    try {
      await withSpinner(
        { start: 'Removing contact...', success: 'Contact removed' },
        () => client.delete(`/audiences/${args.id}/contacts/${args['contact-id']}`),
      )

      if (isJsonOutput(args)) {
        json({ removed: true })
      } else {
        success('Contact removed from audience')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
