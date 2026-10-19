import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Topic {
  id: string
}

export default defineCommand({
  meta: { name: 'create', description: 'Create a topic' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    name: { type: 'string', description: 'Topic name' },
    description: { type: 'string', description: 'Topic description' }
  },
  async run({ args }) {
    let name = args.name

    if (!name && isInteractive()) {
      const result = await p.text({ message: 'Topic name', validate: (v) => (!v ? 'Required' : undefined) })

      if (p.isCancel(result)) {
        return
      }

      name = result
    }

    if (!name) {
      error('Name is required. Use --name.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, string | number | boolean | undefined> = { name }

    if (args.description !== undefined) {
      body.description = args.description
    }

    try {
      const topic = await withSpinner(
        { start: 'Creating topic...', success: 'Topic created' },
        () => client.post<Topic>(`/audiences/${args['audience-id']}/topics`, body)
      )

      if (isJsonOutput(args)) {
        json(topic)
      } else {
        success(`Topic created (${topic.id})`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
