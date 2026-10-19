import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface ActivityStats {
  totalEmails?: number
  sentEmails?: number
  deliveredEmails?: number
  openedEmails?: number
  clickedEmails?: number
  bouncedEmails?: number
  marketingEmails?: number
  transactionalEmails?: number
  rates?: {
    delivery: number
    open: number
    click: number
    bounce: number
  }
}

export default defineCommand({
  meta: { name: 'stats', description: 'Get project activity statistics' },
  args: {
    ...globalArgs
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching stats...' },
        () => client.get<ActivityStats>('/activity/stats')
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        console.log()
        keyValue([
          ['Total Emails', String(data.totalEmails ?? '-')],
          ['Sent', String(data.sentEmails ?? '-')],
          ['Delivered', String(data.deliveredEmails ?? '-')],
          ['Opened', String(data.openedEmails ?? '-')],
          ['Clicked', String(data.clickedEmails ?? '-')],
          ['Bounced', String(data.bouncedEmails ?? '-')],
          ['Marketing', String(data.marketingEmails ?? '-')],
          ['Transactional', String(data.transactionalEmails ?? '-')]
        ])
        if (data.rates) {
          console.log()
          keyValue([
            ['Delivery Rate', `${data.rates.delivery}%`],
            ['Open Rate', `${data.rates.open}%`],
            ['Click Rate', `${data.rates.click}%`],
            ['Bounce Rate', `${data.rates.bounce}%`]
          ])
        }

        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
