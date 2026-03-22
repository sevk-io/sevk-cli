import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'send', description: 'Send a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: false },
    yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    let id = args.id

    // Interactive: pick a broadcast if no ID given
    if (!id && isInteractive()) {
      let broadcasts: any[] = []
      try {
        const result = await withSpinner(
          { start: 'Loading broadcasts...' },
          () => client.get<any>('/broadcasts', { status: 'DRAFT' }),
        )
        const all = result.items || result
        broadcasts = Array.isArray(all) ? all : []
      } catch {}

      if (broadcasts.length === 0) {
        error('No draft broadcasts found. Create one first with `sevk broadcasts create`.')
        process.exitCode = 1; return
      }

      const result = await p.select({
        message: 'Select broadcast to send',
        options: broadcasts.map((b: any) => ({
          value: b.id,
          label: `${b.name || b.subject}`,
          hint: b.scheduledAt ? pc.dim(`scheduled: ${new Date(b.scheduledAt).toLocaleString()}`) : pc.dim(b.subject),
        })),
      })
      if (p.isCancel(result)) return
      id = result as string
    }

    if (!id) {
      error('Broadcast ID is required.')
      process.exitCode = 1; return
    }

    // Fetch broadcast to check if it's scheduled
    let broadcast: any = null
    try {
      broadcast = await client.get<any>(`/broadcasts/${id}`)
    } catch {}

    if (!args.yes && isInteractive()) {
      const isScheduled = broadcast?.scheduledAt
      const msg = isScheduled
        ? `This broadcast is scheduled for ${new Date(broadcast.scheduledAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}. Start sending now?`
        : 'Send this broadcast now?'
      const confirm = await p.confirm({ message: msg })
      if (p.isCancel(confirm) || !confirm) return
    }

    try {
      const result = await withSpinner(
        { start: 'Sending broadcast...', success: 'Broadcast started' },
        () => client.post<any>(`/broadcasts/${id}/send`),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        const isScheduled = broadcast?.scheduledAt
        if (isScheduled) {
          success(`Broadcast will start sending at ${new Date(broadcast.scheduledAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`)
        } else {
          success('Broadcast is now sending')
        }
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
