import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'


export default defineCommand({
  meta: { name: 'create', description: 'Create a template' },
  args: {
    ...globalArgs,
    title: { type: 'string', description: 'Template title' },
    content: { type: 'string', description: 'Template content (HTML or sevk markup)' },
    'content-file': { type: 'string', description: 'Read content from file' },
    style: { type: 'string', description: 'Template style: HTML or MARKUP (default: MARKUP)' },
  },
  async run({ args }) {
    let { title, style } = args
    let content = args.content

    if (args['content-file']) {
      try {
        content = await readFile(args['content-file'], 'utf-8')
      } catch {
        error(`Cannot read file: ${args['content-file']}`)
        process.exitCode = 1; return
      }
    }

    if (isInteractive()) {
      if (!title) {
        const result = await p.text({ message: 'Template title', validate: (v) => (!v ? 'Required' : undefined) })
        if (p.isCancel(result)) return
        title = result
      }

      if (!style) {
        const result = await p.select({
          message: 'Style',
          options: [
            { value: 'MARKUP', label: 'sevk Markup' },
            { value: 'HTML', label: 'HTML' },
          ],
        })
        if (p.isCancel(result)) return
        style = result as string
      }

      if (!content) {
        const result = await p.text({
          message: 'Content',
          placeholder: style === 'MARKUP' ? '<section><heading>Hello</heading></section>' : '<h1>Hello</h1>',
          validate: (v) => (!v || v.length < 2 ? 'Content must be at least 2 characters' : undefined),
        })
        if (p.isCancel(result)) return
        content = result as string
      }
    }

    if (!title) {
      error('Title is required. Use --title.')
      process.exitCode = 1; return
    }

    if (!content) {
      error('Content is required. Use --content or --content-file.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = { title, content }
    if (style) body.style = style

    try {
      const template = await withSpinner(
        { start: 'Creating template...', success: 'Template created' },
        () => client.post<any>('/templates', body),
      )

      if (isJsonOutput(args)) {
        json(template)
      } else {
        success(`Template created: ${template.title} (${template.id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
