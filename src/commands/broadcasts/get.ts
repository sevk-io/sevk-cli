import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'
import pc from 'picocolors'

const statusColor: Record<string, (s: string) => string> = {
  DRAFT: pc.dim,
  QUEUED: pc.yellow,
  SENDING: pc.blue,
  SENT: pc.green,
  CANCELLED: pc.red,
  FAILED: pc.red,
}

export default defineCommand({
  meta: { name: 'get', description: 'Get broadcast details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const b = await withSpinner(
        { start: 'Fetching broadcast...' },
        () => client.get<any>(`/broadcasts/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(b)
      } else {
        const from = b.senderName && b.senderEmail
          ? `${b.senderName} <${b.senderEmail}@${b.domain?.domain || '?'}>`
          : b.senderEmail
            ? `${b.senderEmail}@${b.domain?.domain || '?'}`
            : '—'

        const target = b.targetType === 'ALL' ? 'All contacts'
          : b.targetType === 'TOPIC' && b.topic ? `Topic: ${b.topic.name}`
          : b.targetType === 'SEGMENT' && b.segment ? `Segment: ${b.segment.name}`
          : b.audience ? `Audience: ${b.audience.name}` : '—'

        const status = (statusColor[b.status] || pc.white)(b.status)

        const pairs: [string, string][] = [
          ['ID', b.id],
          ['Name', b.name || '—'],
          ['Subject', b.subject || '—'],
          ['From', from],
          ['Status', status],
          ['Target', target],
          ['Style', b.style || '—'],
          ['Emails Sent', String(b._count?.emails ?? '—')],
        ]

        if (b.audience) {
          pairs.push(['Audience', `${b.audience.name} (${b.audience._count?.contacts ?? '?'} contacts)`])
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
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
