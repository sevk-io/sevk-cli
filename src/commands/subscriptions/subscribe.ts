import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { assertJsonObject } from '~/lib/json-input'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface SubscribeResponse {
  alreadySubscribed?: boolean
}

export default defineCommand({
  meta: { name: 'subscribe', description: 'Subscribe a contact' },
  args: {
    ...globalArgs,
    email: { type: 'string', description: 'Contact email' },
    'audience-id': { type: 'string', description: 'Audience ID' },
    data: { type: 'string', description: 'Contact metadata as a JSON object' }
  },
  async run({ args }) {
    let email = args.email

    if (!email && isInteractive()) {
      const result = await p.text({
        message: 'Email to subscribe',
        placeholder: 'contact@example.com',
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      email = result
    }

    if (!email) {
      error('Email is required. Use --email.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, unknown> = { email }

    if (args['audience-id']) {
      body.audienceId = args['audience-id']
    }

    if (args.data !== undefined) {
      try {
        body.data = assertJsonObject(JSON.parse(args.data), '--data')
      } catch {
        error('--data must be a valid JSON object.')
        process.exitCode = 1

        return
      }
    }

    try {
      const result = await withSpinner(
        { start: 'Subscribing...', success: 'Subscribed' },
        () => client.post<SubscribeResponse>('/subscriptions/subscribe', body)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else if (result.alreadySubscribed) {
        success(`${email} is already subscribed`)
      } else {
        success(`${email} subscribed`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
