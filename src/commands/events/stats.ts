import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'stats', description: 'Get project event statistics' },
  args: {
    ...globalArgs,
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching stats...' },
        () => client.get<any>('/events/stats'),
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        console.log()
        keyValue([
          ['Total Emails', String(data.totalEmails ?? '—')],
          ['Sent', String(data.sentEmails ?? '—')],
          ['Delivered', String(data.deliveredEmails ?? '—')],
          ['Opened', String(data.openedEmails ?? '—')],
          ['Clicked', String(data.clickedEmails ?? '—')],
          ['Bounced', String(data.bouncedEmails ?? '—')],
          ['Marketing', String(data.marketingEmails ?? '—')],
          ['Transactional', String(data.transactionalEmails ?? '—')],
        ])
        if (data.rates) {
          console.log()
          keyValue([
            ['Delivery Rate', `${data.rates.delivery}%`],
            ['Open Rate', `${data.rates.open}%`],
            ['Click Rate', `${data.rates.click}%`],
            ['Bounce Rate', `${data.rates.bounce}%`],
          ])
        }
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
