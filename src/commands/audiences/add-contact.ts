import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'add-contact', description: 'Add contact(s) to an audience' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
    'contact-ids': { type: 'string', description: 'Contact ID(s), comma-separated', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const contactIds = args['contact-ids'].split(',').map((s: string) => s.trim()).filter(Boolean)

    try {
      const result = await withSpinner(
        { start: 'Adding contacts...', success: 'Contacts added' },
        () => client.post<any>(`/audiences/${args.id}/contacts`, { contactIds }),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${contactIds.length} contact(s) added to audience`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
