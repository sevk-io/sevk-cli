import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'


export default defineCommand({
  meta: { name: 'update', description: 'Update a template' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Template ID', required: true },
    title: { type: 'string', description: 'Template title' },
    content: { type: 'string', description: 'Template content (HTML or sevk markup)' },
    'content-file': { type: 'string', description: 'Read content from file' },
    style: { type: 'string', description: 'Template style: HTML or MARKUP' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = {}

    if (args.title) body.title = args.title
    if (args.content) body.content = args.content
    if (args.style) body.style = args.style
    if (args['content-file']) {
      try {
        body.content = await readFile(args['content-file'], 'utf-8')
      } catch {
        error(`Cannot read file: ${args['content-file']}`)
        process.exitCode = 1; return
      }
    }

    if (Object.keys(body).length === 0) {
      error('Nothing to update. Provide at least one field (--title, --content, --style).')
      process.exitCode = 1; return
    }

    try {
      const template = await withSpinner(
        { start: 'Updating template...', success: 'Template updated' },
        () => client.put<any>(`/templates/${args.id}`, body),
      )

      if (isJsonOutput(args)) {
        json(template)
      } else {
        success(`Template updated: ${template.title}`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
