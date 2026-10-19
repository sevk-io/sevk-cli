import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface AddContactsResponse {
  added: number
}

export default defineCommand({
  meta: { name: 'add-contact', description: 'Add contact(s) to an audience' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
    'contact-ids': { type: 'string', description: 'Contact ID(s), comma-separated', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const contactIds = args['contact-ids'].split(',').map((s: string) => s.trim()).filter(Boolean)

    try {
      const result = await withSpinner(
        { start: 'Adding contacts...', success: 'Contacts added' },
        () => client.post<AddContactsResponse>(`/audiences/${args.id}/contacts`, { contactIds })
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${result.added} contact(s) added to audience`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
