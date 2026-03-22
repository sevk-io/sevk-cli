import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'
import { render } from 'sevk'


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
  meta: { name: 'send', description: 'Send an email' },
  args: {
    ...globalArgs,
    from: { type: 'string', description: 'Sender (e.g. "Name <email@domain.com>")' },
    to: { type: 'string', description: 'Recipient(s), comma-separated' },
    subject: { type: 'string', description: 'Email subject' },
    html: { type: 'string', description: 'HTML body' },
    text: { type: 'string', description: 'Plain text body' },
    markup: { type: 'string', description: 'sevk markup body' },
    'html-file': { type: 'string', description: 'Read HTML from file' },
    'text-file': { type: 'string', description: 'Read text from file' },
    'markup-file': { type: 'string', description: 'Read sevk markup from file' },
    'reply-to': { type: 'string', description: 'Reply-to address(es), comma-separated' },
    cc: { type: 'string', description: 'CC address(es), comma-separated' },
    bcc: { type: 'string', description: 'BCC address(es), comma-separated' },
  },
  async run({ args }) {
    let { from, to, subject } = args
    let html = args.html
    let text = args.text

    // Read from files
    if (args['html-file']) {
      try { html = await readFile(args['html-file'], 'utf-8') } catch {
        error(`Cannot read file: ${args['html-file']}`); process.exitCode = 1; return
      }
    }
    if (args['text-file']) {
      try { text = await readFile(args['text-file'], 'utf-8') } catch {
        error(`Cannot read file: ${args['text-file']}`); process.exitCode = 1; return
      }
    }
    if (args['markup-file']) {
      try {
        const raw = await readFile(args['markup-file'], 'utf-8')
        html = render(raw)
      } catch (err: any) {
        error(err.message || `Cannot read file: ${args['markup-file']}`); process.exitCode = 1; return
      }
    }
    if (args.markup) {
      html = render(args.markup)
    }

    // Smart interactive mode
    if (isInteractive() && (!from || !to || !subject)) {
      const client = await createClient(getClientOpts(args))

      // From: fetch verified domains and suggest addresses
      if (!from) {
        let domains: any[] = []
        try {
          const result = await withSpinner(
            { start: 'Loading verified domains...' },
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

      if (!to) {
        const result = await p.text({
          message: 'To',
          placeholder: 'recipient@example.com (comma-separated for multiple)',
          validate: (v) => (!v ? 'Required' : undefined),
        })
        if (p.isCancel(result)) return
        to = result
      }

      if (!subject) {
        const result = await p.text({
          message: 'Subject',
          validate: (v) => (!v ? 'Required' : undefined),
        })
        if (p.isCancel(result)) return
        subject = result as string
      }

      if (!html && !text) {
        const bodyType = await p.select({
          message: 'Body type',
          options: [
            { value: 'text', label: 'Plain text' },
            { value: 'html', label: 'HTML' },
            { value: 'markup', label: 'sevk markup' },
            { value: 'file', label: 'From file (.html or .sevk)' },
          ],
        })
        if (p.isCancel(bodyType)) return

        if (bodyType === 'file') {
          const filePath = await p.text({
            message: 'File path',
            placeholder: 'email.html or email.sevk',
            validate: (v) => (!v ? 'Required' : undefined),
          })
          if (p.isCancel(filePath)) return
          try { html = await readFile(filePath, 'utf-8') } catch {
            error(`Cannot read file: ${filePath}`); process.exitCode = 1; return
          }
        } else if (bodyType === 'markup') {
          const content = await p.text({
            message: 'sevk markup',
            placeholder: '<section><heading>Hello</heading><paragraph>World</paragraph></section>',
          })
          if (p.isCancel(content)) return
          html = render(content as string)
        } else if (bodyType === 'html') {
          const content = await p.text({ message: 'HTML body' })
          if (p.isCancel(content)) return
          html = content as string
        } else {
          const content = await p.text({ message: 'Text body' })
          if (p.isCancel(content)) return
          text = content as string
        }
      }
    }

    if (!from || !to || !subject) {
      error('Missing required fields: --from, --to, --subject')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const toArray = to.split(',').map((s: string) => s.trim()).filter(Boolean)

    const body: Record<string, any> = {
      from,
      to: toArray.length === 1 ? toArray[0] : toArray,
      subject,
    }
    if (html) body.html = html
    if (text) body.text = text
    if (args['reply-to']) body.reply_to = args['reply-to'].split(',').map((s: string) => s.trim())
    if (args.cc) body.cc = args.cc.split(',').map((s: string) => s.trim())
    if (args.bcc) body.bcc = args.bcc.split(',').map((s: string) => s.trim())

    try {
      const result = await withSpinner(
        { start: 'Sending email...', success: 'Email sent' },
        () => client.post<{ id?: string; ids?: string[] }>('/emails', body),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        const id = result.id || result.ids?.join(', ')
        success(`Email sent (${id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
