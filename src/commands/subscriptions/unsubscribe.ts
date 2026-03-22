import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'unsubscribe', description: 'Unsubscribe a contact' },
  args: {
    ...globalArgs,
    email: { type: 'string', description: 'Contact email' },
    'audience-id': { type: 'string', description: 'Audience ID' },
  },
  async run({ args }) {
    let email = args.email

    if (!email && isInteractive()) {
      const result = await p.text({
        message: 'Email to unsubscribe',
        placeholder: 'contact@example.com',
        validate: (v) => (!v ? 'Required' : undefined),
      })
      if (p.isCancel(result)) return
      email = result
    }

    if (!email) {
      error('Email is required. Use --email.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = { email }
    if (args['audience-id']) body.audienceId = args['audience-id']

    try {
      const result = await withSpinner(
        { start: 'Unsubscribing...', success: 'Unsubscribed' },
        () => client.post<any>('/subscriptions/unsubscribe', body),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${email} unsubscribed`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
