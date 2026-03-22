import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'add-contact', description: 'Add contacts to a topic' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Topic ID', required: true },
    contacts: { type: 'string', description: 'Contact IDs (comma-separated)', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const contactIds = args.contacts.split(',').map((s: string) => s.trim()).filter(Boolean)

    try {
      const result = await withSpinner(
        { start: 'Adding contacts to topic...' },
        () => client.post<any>(`/audiences/${args['audience-id']}/topics/${args.id}/contacts`, { contactIds }),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success('Contacts added to topic')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
