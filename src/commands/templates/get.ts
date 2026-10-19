import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Template {
  id: string
  title?: string | null
  style?: string | null
  createdAt: string
  updatedAt?: string | null
}

export default defineCommand({
  meta: { name: 'get', description: 'Get template details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Template ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const template = await withSpinner(
        { start: 'Fetching template...' },
        () => client.get<Template>(`/templates/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(template)
      } else {
        console.log()
        keyValue([
          ['ID', template.id],
          ['Title', template.title || '-'],
          ['Style', template.style || '-'],
          ['Created', new Date(template.createdAt).toLocaleString()],
          ['Updated', template.updatedAt ? new Date(template.updatedAt).toLocaleString() : '-']
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
