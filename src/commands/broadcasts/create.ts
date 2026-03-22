import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'


const SENDER_PREFIXES = [
  'noreply',
  'hello',
  'hi',
  'info',
  'support',
  'contact',
  'no-reply',
  'team',
  'news',
]

export default defineCommand({
  meta: { name: 'create', description: 'Create a broadcast' },
  args: {
    ...globalArgs,
    name: { type: 'string', description: 'Broadcast name' },
    from: { type: 'string', description: 'Sender address' },
    subject: { type: 'string', description: 'Email subject' },
    html: { type: 'string', description: 'HTML body' },
    markup: { type: 'string', description: 'sevk markup body' },
    'html-file': { type: 'string', description: 'Read HTML from file' },
    'markup-file': { type: 'string', description: 'Read sevk markup from file' },
    'audience-id': { type: 'string', description: 'Target audience ID' },
  },
  async run({ args }) {
    let { name, from, subject } = args
    let html = args.html
    let audienceId = args['audience-id']

    if (args['html-file']) {
      try { html = await readFile(args['html-file'], 'utf-8') } catch {
        error(`Cannot read file: ${args['html-file']}`); process.exitCode = 1; return
      }
    }
    if (args['markup-file']) {
      try { html = await readFile(args['markup-file'], 'utf-8') } catch {
        error(`Cannot read file: ${args['markup-file']}`); process.exitCode = 1; return
      }
    }
    if (args.markup) {
      html = args.markup
    }

    if (isInteractive() && (!name || !from || !subject)) {
      const client = await createClient(getClientOpts(args))

      // Name
      if (!name) {
        const result = await p.text({ message: 'Broadcast name', validate: (v) => (!v ? 'Required' : undefined) })
        if (p.isCancel(result)) return
        name = result
      }

      // From: smart domain selection
      if (!from) {
        let domains: any[] = []
        try {
          const result = await withSpinner(
            { start: 'Loading domains...' },
            () => client.get<any>('/domains'),
          )
          const all = result.items || result
          domains = Array.isArray(all) ? all.filter((d: any) => d.verified) : []
        } catch {}

        if (domains.length > 0) {
          const domain = domains.length === 1
            ? domains[0]
            : await (async () => {
                const result = await p.select({
                  message: 'Select a verified domain',
                  options: domains.map((d: any) => ({ value: d, label: d.domain })),
                })
                if (p.isCancel(result)) return
                return result as any
              })()

          const suggestions = SENDER_PREFIXES.map((prefix) => `${prefix}@${domain.domain}`)
          const fromResult = await p.select({
            message: `From address (@${domain.domain})`,
            options: [
              ...suggestions.map((addr) => ({ value: addr, label: addr })),
              { value: '__custom__', label: 'Custom address...' },
            ],
          })
          if (p.isCancel(fromResult)) return

          if (fromResult === '__custom__') {
            const custom = await p.text({
              message: 'From address',
              placeholder: `you@${domain.domain}`,
              validate: (v) => (!v ? 'Required' : undefined),
            })
            if (p.isCancel(custom)) return
            from = custom
          } else {
            from = fromResult as string
          }
        } else {
          const result = await p.text({
            message: 'From',
            placeholder: 'Name <email@domain.com>',
            validate: (v) => (!v ? 'Required' : undefined),
          })
          if (p.isCancel(result)) return
          from = result
        }
      }

      // Subject
      if (!subject) {
        const result = await p.text({ message: 'Subject', validate: (v) => (!v ? 'Required' : undefined) })
        if (p.isCancel(result)) return
        subject = result as string
      }

      // Audience selection
      if (!audienceId) {
        let audiences: any[] = []
        try {
          const result = await withSpinner(
            { start: 'Loading audiences...' },
            () => client.get<any>('/audiences'),
          )
          const all = result.items || result
          audiences = Array.isArray(all) ? all : []
        } catch {}

        if (audiences.length > 0) {
          const result = await p.select({
            message: 'Target audience',
            options: [
              ...audiences.map((a: any) => ({
                value: a.id,
                label: a.name,
                hint: a._count?.contacts ? `${a._count.contacts} contacts` : undefined,
              })),
              { value: '__skip__', label: 'Skip (set later)' },
            ],
          })
          if (p.isCancel(result)) return
          if (result !== '__skip__') audienceId = result as string
        }
      }
    }

    if (!name || !from || !subject) {
      error('Missing required fields: --name, --from, --subject')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = { name, from, subject }
    if (html) body.html = html
    if (audienceId) body.audienceId = audienceId

    try {
      const broadcast = await withSpinner(
        { start: 'Creating broadcast...', success: 'Broadcast created' },
        () => client.post<any>('/broadcasts', body),
      )

      if (isJsonOutput(args)) {
        json(broadcast)
      } else {
        success(`Broadcast created (${broadcast.id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
