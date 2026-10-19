import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { validateIdempotencyKey } from '~/lib/idempotency-key'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface BroadcastSummary {
  id: string
  name?: string | null
  subject?: string | null
  status: string
}

interface ListResponse {
  items: BroadcastSummary[]
}

export default defineCommand({
  meta: { name: 'test', description: 'Send a test email for a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: false },
    'idempotency-key': { type: 'string', description: 'Stable retry key for queue recovery' },
    to: { type: 'string', description: 'Test recipient email(s), comma-separated (max 10)' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    let id = args.id
    let to = args.to

    if (isInteractive()) {
      if (!id) {
        let broadcasts: BroadcastSummary[] = []

        try {
          const result = await withSpinner(
            { start: 'Loading broadcasts...' },
            () => client.get<ListResponse>('/broadcasts')
          )

          broadcasts = result.items
        } catch { /* ignore */ }

        if (broadcasts.length === 0) {
          error('No broadcasts found.')
          process.exitCode = 1

          return
        }

        const result = await p.select({
          message: 'Select broadcast',
          options: broadcasts.map((b) => ({
            value: b.id,
            label: `${b.name || b.subject}`,
            hint: pc.dim(`${b.status}`)
          }))
        })

        if (p.isCancel(result)) {
          return
        }

        id = result as string
      }

      if (!to) {
        const result = await p.text({
          message: 'Send test to',
          placeholder: 'you@example.com',
          validate: (v) => (!v ? 'Required' : undefined)
        })

        if (p.isCancel(result)) {
          return
        }

        to = result
      }
    }

    if (!id) {
      error('Broadcast ID is required.')
      process.exitCode = 1

      return
    }

    if (!to) {
      error('Recipient is required. Use --to.')
      process.exitCode = 1

      return
    }

    const emails = to.split(',').map((s) => s.trim()).filter(Boolean)
    if (emails.length < 1 || emails.length > 10) {
      error('Test recipients must contain between 1 and 10 email addresses.')
      process.exitCode = 1

      return
    }
    const idempotencyKey = validateIdempotencyKey(args['idempotency-key'])

    try {
      const result = await withSpinner(
        { start: 'Queueing test emails...', success: 'Test emails queued' },
        () => client.post<{ testEmails: number, message: string }>(
          `/broadcasts/${id}/test`,
          { emails },
          idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
        )
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        const count = result?.testEmails ?? emails.length

        success(`${count} test email${count === 1 ? '' : 's'} queued for ${emails.join(', ')}`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
