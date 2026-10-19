import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

export default defineCommand({
  meta: { name: 'add-contact', description: 'Add contacts to a topic' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Topic ID', required: true },
    contacts: { type: 'string', description: 'Contact IDs (comma-separated)', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const contactIds = args.contacts.split(',').map((s: string) => s.trim()).filter(Boolean)

    try {
      const result = await withSpinner(
        { start: 'Adding contacts to topic...' },
        () => client.post<unknown>(`/topics/${args.id}/contacts`, { contactIds })
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success('Contacts added to topic')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
