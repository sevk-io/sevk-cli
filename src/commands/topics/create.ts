import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'create', description: 'Create a topic' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    name: { type: 'string', description: 'Topic name' },
  },
  async run({ args }) {
    let name = args.name

    if (!name && isInteractive()) {
      const result = await p.text({ message: 'Topic name', validate: (v) => (!v ? 'Required' : undefined) })
      if (p.isCancel(result)) return
      name = result
    }

    if (!name) {
      error('Name is required. Use --name.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const topic = await withSpinner(
        { start: 'Creating topic...', success: 'Topic created' },
        () => client.post<any>(`/audiences/${args['audience-id']}/topics`, { name }),
      )

      if (isJsonOutput(args)) {
        json(topic)
      } else {
        success(`Topic created (${topic.id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
