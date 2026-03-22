import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'get', description: 'Get template details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Template ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const template = await withSpinner(
        { start: 'Fetching template...' },
        () => client.get<any>(`/templates/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json(template)
      } else {
        console.log()
        keyValue([
          ['ID', template.id],
          ['Title', template.title || '—'],
          ['Style', template.style || '—'],
          ['Created', new Date(template.createdAt).toLocaleString()],
          ['Updated', template.updatedAt ? new Date(template.updatedAt).toLocaleString() : '—'],
        ])
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
