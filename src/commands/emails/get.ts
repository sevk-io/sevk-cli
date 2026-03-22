import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'get', description: 'Get email details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Email ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const email = await withSpinner(
        { start: 'Fetching email...' },
        () => client.get<any>(`/emails/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(email)
      } else {
        console.log()
        keyValue([
          ['ID', email.id],
          ['To', email.to],
          ['Subject', email.subject || ''],
          ['Status', email.status],
          ['Created', new Date(email.createdAt).toLocaleString()],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
