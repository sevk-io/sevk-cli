import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'update', description: 'Update a contact' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Contact ID', required: true },
    email: { type: 'string', description: 'New email' },
    'first-name': { type: 'string', description: 'First name' },
    'last-name': { type: 'string', description: 'Last name' },
    subscribed: { type: 'boolean', description: 'Subscription status' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = {}
    if (args.email) body.email = args.email
    if (args['first-name']) body.firstName = args['first-name']
    if (args['last-name']) body.lastName = args['last-name']
    if (args.subscribed !== undefined) body.subscribed = args.subscribed

    if (Object.keys(body).length === 0) {
      error('Nothing to update. Provide at least one field.')
      process.exitCode = 1; return
    }

    try {
      const contact = await withSpinner(
        { start: 'Updating contact...', success: 'Contact updated' },
        () => client.put<any>(`/contacts/${args.id}`, body),
      )

      if (isJsonOutput(args)) {
        json(contact)
      } else {
        success('Contact updated')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
