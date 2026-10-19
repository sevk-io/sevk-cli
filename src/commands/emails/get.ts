import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Email {
  id: string
  to: string | null
  subject?: string | null
  status: string
  createdAt: string
  scheduledAt?: string | null
  cancelledAt?: string | null
}

export default defineCommand({
  meta: { name: 'get', description: 'Get email details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Email ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const email = await withSpinner(
        { start: 'Fetching email...' },
        () => client.get<Email>(`/emails/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(email)
      } else {
        console.log()
        keyValue([
          ['ID', email.id],
          ['To', email.to ?? ''],
          ['Subject', email.subject || ''],
          ['Status', email.status],
          ...(email.scheduledAt ? [['Scheduled', new Date(email.scheduledAt).toLocaleString()] as [string, string]] : []),
          ...(email.cancelledAt ? [['Cancelled', new Date(email.cancelledAt).toLocaleString()] as [string, string]] : []),
          ['Created', new Date(email.createdAt).toLocaleString()]
        ])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
