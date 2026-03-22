import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'test', description: 'Send a test webhook' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Sending test webhook...', success: 'Test webhook sent' },
        () => client.post<any>(`/webhooks/${args.id}/test`),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        console.log()
        keyValue([
          ['Status', String(result.statusCode || result.status || '—')],
          ['Response', result.success ? 'OK' : (result.error || '—')],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
