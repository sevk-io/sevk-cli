import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface TestResult {
  success: boolean
  status: number
  statusText: string
  message: string
}

export default defineCommand({
  meta: { name: 'test', description: 'Send a test webhook' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        {
          start: 'Sending test webhook...',
          success: (response) => response.success ? 'Test webhook sent' : 'Test webhook failed'
        },
        () => client.post<TestResult>(`/webhooks/${args.id}/test`)
      )

      if (!result.success) {
        process.exitCode = 1
      }

      if (isJsonOutput(args)) {
        json(result)
      } else {
        console.log()
        keyValue([
          ['Status', `${result.status} ${result.statusText}`.trim()],
          ['Response', result.success ? 'OK' : result.message]
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
