import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Topic {
  id: string
  name: string
}

export default defineCommand({
  meta: { name: 'update', description: 'Update a topic' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Topic ID', required: true },
    name: { type: 'string', description: 'New name' },
    description: { type: 'string', description: 'New description' }
  },
  async run({ args }) {
    const body: Record<string, string | number | boolean | undefined> = {}

    if (args.name !== undefined) {
      body.name = args.name
    }

    if (args.description !== undefined) {
      body.description = args.description
    }

    const client = await createClient(getClientOpts(args))

    try {
      const topic = await withSpinner(
        { start: 'Updating topic...', success: 'Topic updated' },
        () => client.put<Topic>(`/topics/${args.id}`, body)
      )

      if (isJsonOutput(args)) {
        json(topic)
      } else {
        success('Topic updated')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
