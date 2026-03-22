import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'remove-contact', description: 'Remove a contact from a topic' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Topic ID', required: true },
    'contact-id': { type: 'string', description: 'Contact ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      await withSpinner(
        { start: 'Removing contact from topic...' },
        () => client.delete<any>(`/audiences/${args['audience-id']}/topics/${args.id}/contacts/${args['contact-id']}`),
      )

      if (isJsonOutput(args)) {
        json({ deleted: true })
      } else {
        success('Contact removed from topic')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
