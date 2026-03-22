import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'status', description: 'Get broadcast sending status' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching status...' },
        () => client.get<any>(`/broadcasts/${args.id}/status`),
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        console.log()
        keyValue([
          ['ID', data.id],
          ['Name', data.name || '—'],
          ['Status', data.status],
          ['Total Contacts', String(data.totalContacts ?? '—')],
          ['Emails Sent', String(data.emailsSent ?? '—')],
          ['Failed', String(data.failedEmails ?? '—')],
          ['Pending', String(data.pendingEmails ?? '—')],
        ])

        if (data.progress) {
          console.log()
          keyValue([
            ['Progress', `${data.progress.percentage}%`],
            ['Est. Remaining', data.progress.estimatedTimeRemaining || '—'],
          ])
        }

        if (data.schedule) {
          console.log()
          keyValue([
            ['Scheduled At', data.schedule.scheduledAt],
            ['Sends In', data.schedule.willSendIn || '—'],
          ])
        }

        if (data.completion) {
          console.log()
          keyValue([
            ['Completed At', data.completion.completedAt],
            ['Success Rate', `${data.completion.successRate}%`],
          ])
        }

        if (data.warning) {
          console.log()
          console.log(`  ⚠ ${data.warning.message}`)
        }

        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
