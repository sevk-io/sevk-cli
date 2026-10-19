import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Template {
  id: string
  title: string
  content: string
  style: string
  createdAt: string
  updatedAt: string
}

export default defineCommand({
  meta: { name: 'duplicate', description: 'Duplicate a template' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Template ID to duplicate', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const template = await withSpinner(
        { start: 'Duplicating template...', success: 'Template duplicated' },
        () => client.post<Template>(`/templates/${args.id}/duplicate`)
      )

      if (isJsonOutput(args)) {
        json(template)
      } else {
        success(`Template duplicated (${template.id})`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
