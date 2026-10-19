import * as p from '@clack/prompts'
import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface BroadcastSummary {
  id: string
  name?: string | null
  subject?: string | null
  scheduledAt?: string | null
}

interface ListResponse {
  items: BroadcastSummary[]
}

interface SendBroadcastResponse {
  status: string
  scheduledAt: string | null
}

export default defineCommand({
  meta: { name: 'send', description: 'Send a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: false },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    let id = args.id

    if (!id && isInteractive()) {
      let broadcasts: BroadcastSummary[] = []

      try {
        const result = await withSpinner(
          { start: 'Loading broadcasts...' },
          () => client.get<ListResponse>('/broadcasts', { status: 'DRAFT' })
        )

        broadcasts = result.items
      } catch { /* ignore */ }

      if (broadcasts.length === 0) {
        error('No draft broadcasts found. Create one first with `sevk broadcasts create`.')
        process.exitCode = 1

        return
      }

      const result = await p.select({
        message: 'Select broadcast to send',
        options: broadcasts.map((b) => ({
          value: b.id,
          label: `${b.name || b.subject}`,
          hint: b.scheduledAt ? pc.dim(`scheduled: ${new Date(b.scheduledAt).toLocaleString()}`) : pc.dim(b.subject ?? '')
        }))
      })

      if (p.isCancel(result)) {
        return
      }

      id = result as string
    }

    if (!id) {
      error('Broadcast ID is required.')
      process.exitCode = 1

      return
    }

    let broadcast: { scheduledAt?: string | null } | null = null

    try {
      broadcast = await client.get<{ scheduledAt?: string | null }>(`/broadcasts/${id}`)
    } catch { /* ignore */ }

    if (!args.yes && isInteractive()) {
      const scheduledAt = broadcast?.scheduledAt
      const msg = scheduledAt && Date.parse(scheduledAt) > Date.now()
        ? `Schedule this broadcast for ${new Date(scheduledAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}?`
        : 'Send this broadcast now?'
      const confirm = await p.confirm({ message: msg })

      if (p.isCancel(confirm) || !confirm) {
        return
      }
    }

    try {
      const result = await withSpinner(
        { start: 'Submitting broadcast...', success: 'Broadcast accepted' },
        () => client.post<SendBroadcastResponse>(`/broadcasts/${id}/send`)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        if (result.status === 'SCHEDULED' && result.scheduledAt) {
          success(`Broadcast will start sending at ${new Date(result.scheduledAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`)
        } else {
          success('Broadcast is now sending')
        }
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
