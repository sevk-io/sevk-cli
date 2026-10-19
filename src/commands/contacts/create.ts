import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Audience {
  id: string
  name: string
  contactsCount?: number
}

interface AudienceListResponse {
  items: Audience[]
}

interface Contact {
  id: string
}

export default defineCommand({
  meta: { name: 'create', description: 'Create a contact' },
  args: {
    ...globalArgs,
    email: { type: 'string', description: 'Contact email' },
    'first-name': { type: 'string', description: 'First name' },
    'last-name': { type: 'string', description: 'Last name' },
    'audience-id': { type: 'string', description: 'Add the new contact to this audience after creation' },
    unsubscribed: { type: 'boolean', description: 'Create as unsubscribed' }
  },
  async run({ args }) {
    let email = args.email
    let firstName = args['first-name']
    let lastName = args['last-name']
    let audienceId = args['audience-id']

    if (isInteractive() && !email) {
      const client = await createClient(getClientOpts(args))

      const emailResult = await p.text({
        message: 'Email',
        placeholder: 'contact@example.com',
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(emailResult)) {
        return
      }

      email = emailResult

      if (!firstName) {
        const result = await p.text({ message: 'First name', placeholder: '(optional, press enter to skip)' })

        if (p.isCancel(result)) {
          return
        }

        if (result) {
          firstName = result
        }
      }

      if (!lastName) {
        const result = await p.text({ message: 'Last name', placeholder: '(optional, press enter to skip)' })

        if (p.isCancel(result)) {
          return
        }

        if (result) {
          lastName = result
        }
      }

      if (!audienceId) {
        let audiences: Audience[] = []

        try {
          const result = await withSpinner(
            { start: 'Loading audiences...' },
            () => client.get<AudienceListResponse>('/audiences')
          )

          audiences = result.items
        } catch { /* ignore */ }

        if (audiences.length > 0) {
          const result = await p.select({
            message: 'Add to audience',
            options: [
              { value: '__skip__', label: 'Skip' },
              ...audiences.map((a) => ({
                value: a.id,
                label: a.name,
                hint: a.contactsCount ? `${a.contactsCount} contacts` : undefined
              }))
            ]
          })

          if (p.isCancel(result)) {
            return
          }

          if (result !== '__skip__') {
            audienceId = result as string
          }
        }
      }
    }

    if (!email) {
      error('Email is required. Use --email.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, unknown> = { email }
    const data: Record<string, unknown> = {}

    if (firstName) {
      data.firstName = firstName
    }

    if (lastName) {
      data.lastName = lastName
    }

    if (Object.keys(data).length > 0) {
      body.data = data
    }

    if (args.unsubscribed) {
      body.subscribed = false
    }

    try {
      const contact = await withSpinner(
        { start: 'Creating contact...', success: 'Contact created' },
        () => client.post<Contact>('/contacts', body)
      )

      if (audienceId) {
        try {
          await client.post(`/audiences/${audienceId}/contacts`, { contactIds: [contact.id] })
        } catch (err: unknown) {
          error(`Contact created but adding to audience failed: ${err instanceof Error ? err.message : String(err)}`)
          if (isJsonOutput(args)) {
            json(contact)
          }

          process.exitCode = 1

          return
        }
      }

      if (isJsonOutput(args)) {
        json(contact)
      } else {
        success(`Contact created (${contact.id})${audienceId ? ` and added to audience` : ''}`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
