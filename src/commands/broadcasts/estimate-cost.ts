import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface CostEstimate {
  contactCount?: number | null
  emailPrice?: number | null
  freeEmailsAvailable?: number | null
  freeEmailsToUse?: number | null
  paidEmailsCount?: number | null
  estimatedCost?: number | null
  currentBalance?: number | null
  hasSufficientBalance?: boolean | null
  shortfall?: number | null
}

export default defineCommand({
  meta: { name: 'estimate-cost', description: 'Estimate broadcast sending cost' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Estimating cost...' },
        () => client.get<CostEstimate>(`/broadcasts/${args.id}/estimate-cost`)
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        console.log()
        keyValue([
          ['Contacts', String(data.contactCount ?? '-')],
          ['Email Price', data.emailPrice != null ? `$${Number(data.emailPrice).toFixed(6)}` : '-'],
          ['Free Emails Available', String(data.freeEmailsAvailable ?? '-')],
          ['Free Emails to Use', String(data.freeEmailsToUse ?? '-')],
          ['Paid Emails', String(data.paidEmailsCount ?? '-')],
          ['Estimated Cost', data.estimatedCost != null ? `$${Number(data.estimatedCost).toFixed(4)}` : '-'],
          ['Current Balance', data.currentBalance != null ? `$${Number(data.currentBalance).toFixed(4)}` : '-'],
          ['Sufficient Balance', data.hasSufficientBalance != null ? (data.hasSufficientBalance ? 'Yes' : 'No') : '-'],
          ...(data.shortfall != null && data.shortfall > 0 ? [['Shortfall', `$${Number(data.shortfall).toFixed(4)}`] as [string, string]] : [])
        ])
        console.log()
      }
    } catch (err: unknown) {
      if ((err as { statusCode?: number })?.statusCode === 404) {
        error('Cost estimation is not available on this server. Use `sevk broadcasts status` for recipient counts instead.')
        process.exitCode = 1

        return
      }

      error(err)
      process.exitCode = 1

      return
    }
  }
})
