import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

export default defineCommand({
  meta: { name: 'remove-contact', description: 'Remove a contact from a topic' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Topic ID', required: true },
    'contact-id': { type: 'string', description: 'Contact ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Removing contact from topic...' },
        () => client.delete<{ topicId: string, contactId: string, removed: true }>(
          `/topics/${args.id}/contacts/${args['contact-id']}`
        )
      )

      if (isJsonOutput(args)) {
        json(result ?? { topicId: args.id, contactId: args['contact-id'], removed: true })
      } else {
        success('Contact removed from topic')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
