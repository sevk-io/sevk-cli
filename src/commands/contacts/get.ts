import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Contact {
  id: string
  email: string
  subscribed: boolean
  data?: { firstName?: string, lastName?: string, [k: string]: unknown } | null
  createdAt: string
}

const contactName = (value: unknown): string =>
  typeof value === 'string' && value ? value : '-'

export default defineCommand({
  meta: { name: 'get', description: 'Get contact details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Contact ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const contact = await withSpinner(
        { start: 'Fetching contact...' },
        () => client.get<Contact>(`/contacts/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(contact)
      } else {
        console.log()
        keyValue([
          ['ID', contact.id],
          ['Email', contact.email],
          ['First Name', contactName(contact.data?.firstName)],
          ['Last Name', contactName(contact.data?.lastName)],
          ['Subscribed', contact.subscribed ? 'Yes' : 'No'],
          ['Created', new Date(contact.createdAt).toLocaleString()]
        ])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
