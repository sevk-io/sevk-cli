import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

const statusColor: Record<string, (s: string) => string> = {
  DRAFT: pc.dim,
  SCHEDULED: pc.cyan,
  STARTING: pc.yellow,
  SENDING: pc.blue,
  SENT: pc.green,
  FAILED: pc.red,
  CANCELLING: pc.yellow,
  CANCELLED: pc.red
}

interface Broadcast {
  id: string
  name?: string | null
  subject?: string | null
  senderName?: string | null
  email?: string | null
  status: string
  targetType?: string | null
  style?: string | null
  sentCount?: number | null
  failedCount?: number | null
  topic?: { name: string } | null
  segment?: { name: string } | null
  audience?: { name: string, contactsCount?: number | null } | null
  domain?: { domain: string } | null
  scheduledAt?: string | null
  sentAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export default defineCommand({
  meta: { name: 'get', description: 'Get broadcast details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const b = await withSpinner(
        { start: 'Fetching broadcast...' },
        () => client.get<Broadcast>(`/broadcasts/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(b)
      } else {
        const from = b.senderName && b.email
          ? `${b.senderName} <${b.email}>`
          : b.email
            ? b.email
            : '-'

        const target = b.targetType === 'ALL' ? 'All contacts'
          : b.targetType === 'TOPIC' && b.topic ? `Topic: ${b.topic.name}`
            : b.targetType === 'SEGMENT' && b.segment ? `Segment: ${b.segment.name}`
              : b.audience ? `Audience: ${b.audience.name}` : '-'

        const status = (statusColor[b.status] || pc.white)(b.status)

        const pairs: [string, string][] = [
          ['ID', b.id],
          ['Name', b.name || '-'],
          ['Subject', b.subject || '-'],
          ['From', from],
          ['Status', status],
          ['Target', target],
          ['Style', b.style || '-'],
          ['Emails Sent', String(((b.sentCount ?? 0) + (b.failedCount ?? 0)) || '-')]
        ]

        if (b.audience) {
          pairs.push(['Audience', `${b.audience.name} (${b.audience.contactsCount ?? '?'} contacts)`])
        }

        if (b.domain) {
          pairs.push(['Domain', b.domain.domain])
        }

        if (b.scheduledAt) {
          pairs.push(['Scheduled', new Date(b.scheduledAt).toLocaleString()])
        }

        if (b.sentAt) {
          pairs.push(['Sent At', new Date(b.sentAt).toLocaleString()])
        }

        if (b.completedAt) {
          pairs.push(['Completed', new Date(b.completedAt).toLocaleString()])
        }

        pairs.push(['Created', new Date(b.createdAt).toLocaleString()])
        pairs.push(['Updated', new Date(b.updatedAt).toLocaleString()])

        console.log()
        keyValue(pairs)
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
