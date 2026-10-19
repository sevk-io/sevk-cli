import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Topic {
  id: string
  name: string
  createdAt: string
}

export default defineCommand({
  meta: { name: 'get', description: 'Get topic details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Topic ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const topic = await withSpinner(
        { start: 'Fetching topic...' },
        () => client.get<Topic>(`/topics/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(topic)
      } else {
        console.log()
        keyValue([
          ['ID', topic.id],
          ['Name', topic.name],
          ['Created', new Date(topic.createdAt).toLocaleString()]
        ])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
