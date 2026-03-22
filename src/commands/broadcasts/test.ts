import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'test', description: 'Send a test email for a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: false },
    to: { type: 'string', description: 'Test recipient email' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    let id = args.id
    let to = args.to

    if (isInteractive()) {
      // Pick broadcast if no ID
      if (!id) {
        let broadcasts: any[] = []
        try {
          const result = await withSpinner(
            { start: 'Loading broadcasts...' },
            () => client.get<any>('/broadcasts'),
          )
          const all = result.items || result
          broadcasts = Array.isArray(all) ? all : []
        } catch {}

        if (broadcasts.length === 0) {
          error('No broadcasts found.')
          process.exitCode = 1; return
        }

        const result = await p.select({
          message: 'Select broadcast',
          options: broadcasts.map((b: any) => ({
            value: b.id,
            label: `${b.name || b.subject}`,
            hint: pc.dim(`${b.status}`),
          })),
        })
        if (p.isCancel(result)) return
        id = result as string
      }

      // Pick recipient
      if (!to) {
        const result = await p.text({
          message: 'Send test to',
          placeholder: 'you@example.com',
          validate: (v) => (!v ? 'Required' : undefined),
        })
        if (p.isCancel(result)) return
        to = result
      }
    }

    if (!id) {
      error('Broadcast ID is required.')
      process.exitCode = 1; return
    }

    if (!to) {
      error('Recipient is required. Use --to.')
      process.exitCode = 1; return
    }

    try {
      const result = await withSpinner(
        { start: 'Sending test email...', success: 'Test email sent' },
        () => client.post<any>(`/broadcasts/${id}/test`, { to }),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`Test email sent to ${to}`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
