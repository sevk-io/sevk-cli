import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface BroadcastStatus {
  id: string
  name: string
  status: string
  totalContacts: number
  emailsSent: number
  failedEmails: number
  pendingEmails: number
  createdAt: string
  sentAt: string | null
  completedAt: string | null
  scheduledAt: string | null
  step?: string
  stepLabel?: string
  stepIndex?: number
  stepTotal?: number
  stepProgress?: number
  warning?: { type: string, message: string, failedCount: number }
  progress?: {
    percentage: number
    emailsSent: number
    totalContacts: number
    pendingEmails: number
    estimatedTimeRemaining: string | null
  }
  sendingStartedAt?: string
  schedule?: {
    scheduledAt: string | null
    timeUntilSend: number
    willSendIn: string
    isPastDue: boolean
  }
  completion?: { completedAt: string | null, totalEmailsSent: number, successRate: number }
}

export default defineCommand({
  meta: { name: 'status', description: 'Get broadcast sending status' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching status...' },
        () => client.get<BroadcastStatus>(`/broadcasts/${args.id}/status`)
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        console.log()
        keyValue([
          ['ID', data.id],
          ['Name', data.name || '-'],
          ['Status', data.status],
          ['Total Contacts', String(data.totalContacts ?? '-')],
          ['Emails Sent', String(data.emailsSent ?? '-')],
          ['Failed', String(data.failedEmails ?? '-')],
          ['Pending', String(data.pendingEmails ?? '-')]
        ])

        if (data.progress) {
          console.log()
          keyValue([
            ['Progress', `${data.progress.percentage}%`],
            ['Est. Remaining', data.progress.estimatedTimeRemaining || '-']
          ])
        }

        if (data.schedule) {
          console.log()
          keyValue([
            ['Scheduled At', data.schedule.scheduledAt ?? '-'],
            ['Sends In', data.schedule.willSendIn || '-']
          ])
        }

        if (data.completion) {
          console.log()
          keyValue([
            ['Completed At', data.completion.completedAt ?? '-'],
            ['Success Rate', `${data.completion.successRate}%`]
          ])
        }

        if (data.warning) {
          console.log()
          console.log(`  ⚠ ${data.warning.message}`)
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
