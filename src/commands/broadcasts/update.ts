import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'


export default defineCommand({
  meta: { name: 'update', description: 'Update a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
    name: { type: 'string', description: 'Broadcast name' },
    from: { type: 'string', description: 'Sender address' },
    subject: { type: 'string', description: 'Email subject' },
    html: { type: 'string', description: 'HTML body' },
    markup: { type: 'string', description: 'sevk markup body' },
    'html-file': { type: 'string', description: 'Read HTML from file' },
    'markup-file': { type: 'string', description: 'Read sevk markup from file' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = {}

    if (args.name) body.name = args.name
    if (args.from) body.from = args.from
    if (args.subject) body.subject = args.subject
    if (args.markup) body.html = args.markup
    if (args.html) body.html = args.html
    if (args['markup-file']) {
      try { body.html = await readFile(args['markup-file'], 'utf-8') } catch {
        error(`Cannot read file: ${args['markup-file']}`); process.exitCode = 1; return
      }
    }
    if (args['html-file']) {
      try { body.html = await readFile(args['html-file'], 'utf-8') } catch {
        error(`Cannot read file: ${args['html-file']}`); process.exitCode = 1; return
      }
    }

    if (Object.keys(body).length === 0) {
      error('Nothing to update. Provide at least one field.')
      process.exitCode = 1; return
    }

    try {
      const broadcast = await withSpinner(
        { start: 'Updating broadcast...', success: 'Broadcast updated' },
        () => client.put<any>(`/broadcasts/${args.id}`, body),
      )

      if (isJsonOutput(args)) {
        json(broadcast)
      } else {
        success('Broadcast updated')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
