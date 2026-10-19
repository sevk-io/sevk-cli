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

type UnsubscribeResponse = Record<string, unknown>

export default defineCommand({
  meta: { name: 'unsubscribe', description: 'Unsubscribe a contact globally' },
  args: {
    ...globalArgs,
    email: { type: 'string', description: 'Contact email' },
    'contact-id': { type: 'string', description: 'Contact ID (alternative to --email)' },
    'broadcast-id': { type: 'string', description: 'Broadcast ID the unsubscribe is attributed to' }
  },
  async run({ args }) {
    let email = args.email
    const contactId = args['contact-id']

    if (!email && !contactId && isInteractive()) {
      const result = await p.text({
        message: 'Email to unsubscribe',
        placeholder: 'contact@example.com',
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      email = result
    }

    if (!email && !contactId) {
      error('Provide --email or --contact-id.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, string | number | boolean | undefined> = {}

    if (email) {
      body.email = email
    }

    if (contactId) {
      body.contactId = contactId
    }

    if (args['broadcast-id']) {
      body.broadcastId = args['broadcast-id']
    }

    try {
      const result = await withSpinner(
        { start: 'Unsubscribing...', success: 'Unsubscribed' },
        () => client.post<UnsubscribeResponse>('/subscriptions/unsubscribe', body)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${email ?? contactId} unsubscribed`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
