import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'duplicate', description: 'Duplicate a template' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Template ID to duplicate', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const template = await withSpinner(
        { start: 'Duplicating template...', success: 'Template duplicated' },
        () => client.post<any>(`/templates/${args.id}/duplicate`),
      )

      if (isJsonOutput(args)) {
        json(template)
      } else {
        success(`Template duplicated (${template.id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
