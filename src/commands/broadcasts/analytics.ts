import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Analytics {
  totalEmails?: number | null
  sentEmails?: number | null
  deliveredEmails?: number | null
  openedEmails?: number | null
  clickedEmails?: number | null
  totalClicks?: number | null
  bouncedEmails?: number | null
  failedEmails?: number | null
  unsubscribedEmails?: number | null
  deliveryRate?: number | null
  openRate?: number | null
  clickRate?: number | null
  bounceRate?: number | null
  unsubscribeRate?: number | null
}

export default defineCommand({
  meta: { name: 'analytics', description: 'Get broadcast analytics' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching analytics...' },
        () => client.get<Analytics>(`/broadcasts/${args.id}/analytics`)
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        console.log()
        keyValue([
          ['Total', String(data.totalEmails ?? '-')],
          ['Sent', String(data.sentEmails ?? '-')],
          ['Delivered', String(data.deliveredEmails ?? '-')],
          ['Opened', String(data.openedEmails ?? '-')],
          ['Clicked', String(data.clickedEmails ?? '-')],
          ['Total Clicks', String(data.totalClicks ?? '-')],
          ['Bounced', String(data.bouncedEmails ?? '-')],
          ['Failed', String(data.failedEmails ?? '-')],
          ['Unsubscribed', String(data.unsubscribedEmails ?? '-')]
        ])
        console.log()
        keyValue([
          ['Delivery Rate', data.deliveryRate != null ? `${data.deliveryRate}%` : '-'],
          ['Open Rate', data.openRate != null ? `${data.openRate}%` : '-'],
          ['Click Rate', data.clickRate != null ? `${data.clickRate}%` : '-'],
          ['Bounce Rate', data.bounceRate != null ? `${data.bounceRate}%` : '-'],
          ['Unsubscribe Rate', data.unsubscribeRate != null ? `${data.unsubscribeRate}%` : '-']
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
