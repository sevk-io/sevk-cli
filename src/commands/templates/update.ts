import { readFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Template {
  id: string
  title: string
}

const TEMPLATE_STYLES = ['HTML', 'MARKUP'] as const

export default defineCommand({
  meta: { name: 'update', description: 'Update a template' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Template ID', required: true },
    title: { type: 'string', description: 'Template title' },
    content: { type: 'string', description: 'Template content (HTML or sevk markup)' },
    'content-file': { type: 'string', description: 'Read content from file' },
    style: { type: 'string', description: 'Template style: HTML or MARKUP' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, string> = {}

    if (args.title !== undefined) {
      body.title = args.title
    }

    if (args.content !== undefined) {
      body.content = args.content
    }

    if (args.style !== undefined) {
      try {
        body.style = parseEnumFlag(args.style, '--style', TEMPLATE_STYLES, {
          uppercase: true
        })
      } catch (err: unknown) {
        error(err)
        process.exitCode = 1

        return
      }
    }

    if (args['content-file'] !== undefined) {
      try {
        body.content = await readFile(args['content-file'], 'utf-8')
      } catch {
        error(`Cannot read file: ${args['content-file']}`)
        process.exitCode = 1

        return
      }
    }

    try {
      const template = await withSpinner(
        { start: 'Updating template...', success: 'Template updated' },
        () => client.put<Template>(`/templates/${args.id}`, body)
      )

      if (isJsonOutput(args)) {
        json(template)
      } else {
        success(`Template updated: ${template.title}`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
