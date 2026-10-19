import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue, table } from '~/lib/table'

interface InboundAttachment {
  id: string
  filename?: string | null
  mimeType?: string | null
  size?: number | null
}

interface InboundReplyToEmail {
  id: string
  subject?: string | null
  to?: string | null
}

interface InboundReplyToBroadcast {
  id: string
  name?: string | null
}

interface InboundEmail {
  id: string
  messageId?: string | null
  fromAddress: string
  toAddress: string
  subject?: string | null
  status: string
  isSpam?: boolean | null
  isVirus?: boolean | null
  spamScore?: number | null
  rawSize?: number | null
  domainId?: string | null
  receivedAt?: string | null
  createdAt?: string | null
  attachments?: InboundAttachment[]
  replyToEmail?: InboundReplyToEmail | null
  replyToBroadcast?: InboundReplyToBroadcast | null
}

export default defineCommand({
  meta: { name: 'get', description: 'Get an inbound email' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Inbound email ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const inbound = await withSpinner(
        { start: 'Fetching inbound email...' },
        () => client.get<InboundEmail>(`/inbound/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(inbound)

        return
      }

      const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleString() : '-'

      console.log()
      keyValue([
        ['ID', inbound.id],
        ['Message ID', inbound.messageId || '-'],
        ['From', inbound.fromAddress],
        ['To', inbound.toAddress],
        ['Subject', inbound.subject || pc.dim('(no subject)')],
        ['Status', inbound.status],
        ['Spam', inbound.isSpam ? pc.red('Yes') : pc.green('No')],
        ['Virus', inbound.isVirus ? pc.red('Yes') : pc.green('No')],
        ['Spam score', inbound.spamScore !== null && inbound.spamScore !== undefined ? String(inbound.spamScore) : '-'],
        ['Size', inbound.rawSize ? `${inbound.rawSize} bytes` : '-'],
        ['Domain ID', inbound.domainId || '-'],
        ['Received', fmtDate(inbound.receivedAt)],
        ['Created', fmtDate(inbound.createdAt)]
      ])

      const attachments = inbound.attachments || []

      if (attachments.length > 0) {
        console.log()
        console.log(pc.bold('Attachments'))
        table(attachments, [
          { key: 'id', label: 'ID' },
          { key: 'filename', label: 'Filename', format: (v: string) => v || '-' },
          { key: 'mimeType', label: 'Type', format: (v: string) => v || '-' },
          { key: 'size', label: 'Size', format: (v: number) => v ? `${v} bytes` : '-' }
        ])
      }

      if (inbound.replyToEmail) {
        console.log()
        console.log(pc.bold('Reply to email'))
        keyValue([
          ['ID', inbound.replyToEmail.id],
          ['Subject', inbound.replyToEmail.subject || '-'],
          ['To', inbound.replyToEmail.to || '-']
        ])
      }

      if (inbound.replyToBroadcast) {
        console.log()
        console.log(pc.bold('Reply to broadcast'))
        keyValue([
          ['ID', inbound.replyToBroadcast.id],
          ['Name', inbound.replyToBroadcast.name || '-']
        ])
      }

      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
