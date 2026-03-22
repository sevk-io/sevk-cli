import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'create', description: 'Create a segment' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    name: { type: 'string', description: 'Segment name' },
  },
  async run({ args }) {
    let name = args.name

    if (!name && isInteractive()) {
      const result = await p.text({ message: 'Segment name', validate: (v) => (!v ? 'Required' : undefined) })
      if (p.isCancel(result)) return
      name = result
    }

    if (!name) {
      error('Name is required. Use --name.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const segment = await withSpinner(
        { start: 'Creating segment...', success: 'Segment created' },
        () => client.post<any>(`/audiences/${args['audience-id']}/segments`, { name }),
      )

      if (isJsonOutput(args)) {
        json(segment)
      } else {
        success(`Segment created (${segment.id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
