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

interface MutationResponse {
  id: string
}

export default defineCommand({
  meta: { name: 'update', description: 'Reschedule an email' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Email ID', required: true },
    'scheduled-at': { type: 'string', description: 'New RFC 3339 delivery time, up to 30 days ahead' }
  },
  async run({ args }) {
    let scheduledAt = args['scheduled-at']

    if (!scheduledAt && isInteractive()) {
      const result = await p.text({
        message: 'New delivery time',
        placeholder: '2026-09-03T10:00:00Z',
        validate: value => (!value ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      scheduledAt = result
    }

    if (!scheduledAt) {
      error('Missing required field: --scheduled-at')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Rescheduling email...', success: 'Email rescheduled' },
        () => client.patch<MutationResponse>(`/emails/${args.id}`, { scheduledAt })
      )

      if (isJsonOutput(args)) json(result)
      else success(`Email rescheduled (${result.id})`)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1
    }
  }
})
