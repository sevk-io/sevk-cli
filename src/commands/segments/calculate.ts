import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface CalculateResponse {
  count: number
  segmentId: string
  segmentName: string
  lastRunAt: string
}

export default defineCommand({
  meta: { name: 'calculate', description: 'Calculate segment size' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Segment ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Calculating segment size...' },
        () => client.get<CalculateResponse>(`/segments/${args.id}/calculate`)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`Segment "${result.segmentName}" contains ${result.count} contacts`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
