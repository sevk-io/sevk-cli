import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'get', description: 'Get contact details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Contact ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const contact = await withSpinner(
        { start: 'Fetching contact...' },
        () => client.get<any>(`/contacts/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(contact)
      } else {
        console.log()
        keyValue([
          ['ID', contact.id],
          ['Email', contact.email],
          ['First Name', contact.firstName || '—'],
          ['Last Name', contact.lastName || '—'],
          ['Subscribed', contact.subscribed ? 'Yes' : 'No'],
          ['Created', new Date(contact.createdAt).toLocaleString()],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
