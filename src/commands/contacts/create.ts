import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'create', description: 'Create a contact' },
  args: {
    ...globalArgs,
    email: { type: 'string', description: 'Contact email' },
    'first-name': { type: 'string', description: 'First name' },
    'last-name': { type: 'string', description: 'Last name' },
    'audience-id': { type: 'string', description: 'Add to audience' },
    unsubscribed: { type: 'boolean', description: 'Create as unsubscribed' },
  },
  async run({ args }) {
    let email = args.email
    let firstName = args['first-name']
    let lastName = args['last-name']
    let audienceId = args['audience-id']

    if (isInteractive() && !email) {
      const client = await createClient(getClientOpts(args))

      // Email
      const emailResult = await p.text({
        message: 'Email',
        placeholder: 'contact@example.com',
        validate: (v) => (!v ? 'Required' : undefined),
      })
      if (p.isCancel(emailResult)) return
      email = emailResult

      // Name (optional)
      if (!firstName) {
        const result = await p.text({ message: 'First name', placeholder: '(optional, press enter to skip)' })
        if (p.isCancel(result)) return
        if (result) firstName = result
      }

      if (!lastName) {
        const result = await p.text({ message: 'Last name', placeholder: '(optional, press enter to skip)' })
        if (p.isCancel(result)) return
        if (result) lastName = result
      }

      // Audience selection
      if (!audienceId) {
        let audiences: any[] = []
        try {
          const result = await withSpinner(
            { start: 'Loading audiences...' },
            () => client.get<any>('/audiences'),
          )
          const all = result.items || result
          audiences = Array.isArray(all) ? all : []
        } catch {}

        if (audiences.length > 0) {
          const result = await p.select({
            message: 'Add to audience',
            options: [
              { value: '__skip__', label: 'Skip' },
              ...audiences.map((a: any) => ({
                value: a.id,
                label: a.name,
                hint: a._count?.contacts ? `${a._count.contacts} contacts` : undefined,
              })),
            ],
          })
          if (p.isCancel(result)) return
          if (result !== '__skip__') audienceId = result as string
        }
      }
    }

    if (!email) {
      error('Email is required. Use --email.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = { email }
    if (firstName) body.firstName = firstName
    if (lastName) body.lastName = lastName
    if (audienceId) body.audienceId = audienceId
    if (args.unsubscribed) body.subscribed = false

    try {
      const contact = await withSpinner(
        { start: 'Creating contact...', success: 'Contact created' },
        () => client.post<any>('/contacts', body),
      )

      if (isJsonOutput(args)) {
        json(contact)
      } else {
        success(`Contact created (${contact.id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
