import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

import * as p from '@clack/prompts'
import { render } from 'sevk'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { parseBooleanFlag } from '~/lib/boolean-flag'
import { createClient } from '~/lib/client'
import type {
  EmailAttachment,
  EmailHeaders,
  EmailTracking
} from '~/lib/email-input'
import { parseEmailHeaders } from '~/lib/email-input'
import { validateIdempotencyKey } from '~/lib/idempotency-key'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

const SENDER_PREFIXES = [
  'noreply',
  'hello',
  'hi',
  'info',
  'support',
  'contact',
  'no-reply',
  'team',
  'news'
]

const MAX_ATTACHMENTS = 10
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime'
}

const guessContentType = (path: string): string => {
  const ext = extname(path).toLowerCase()

  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

interface SendEmailRequest {
  from: string
  to: string | string[]
  subject: string
  html?: string | null
  text?: string | null
  reply_to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: EmailAttachment[]
  tracking?: EmailTracking
  headers?: EmailHeaders
  scheduledAt?: string
}

interface Domain {
  domain: string
  verified?: boolean
}

interface SendResponse {
  id?: string
  ids?: string[]
}

const splitList = (value: string | undefined): string[] => {
  if (!value) {
    return []
  }

  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

const splitCidEntry = (
  entry: string,
  flag: '--cid' | '--inline',
  pathMayHaveDrivePrefix = false
): [string, string] => {
  const searchFrom = pathMayHaveDrivePrefix && /^[A-Za-z]:[\\/]/.test(entry) ? 2 : 0
  const idx = entry.indexOf(':', searchFrom)

  if (idx <= 0 || idx === entry.length - 1) {
    const left = flag === '--cid' ? 'filename' : 'path'

    throw new Error(`Invalid ${flag} value "${entry}". Expected "${left}:cid".`)
  }

  return [entry.slice(0, idx), entry.slice(idx + 1)]
}

const parseCidMap = (raw: string | undefined): Map<string, string> => {
  const map = new Map<string, string>()

  for (const entry of splitList(raw)) {
    const [filename, cid] = splitCidEntry(entry, '--cid')

    map.set(filename, cid)
  }

  return map
}

const parseInlineEntries = (raw: string | undefined): { path: string, cid: string }[] => {
  const out: { path: string, cid: string }[] = []

  for (const entry of splitList(raw)) {
    const [path, cid] = splitCidEntry(entry, '--inline', true)

    out.push({ path, cid })
  }

  return out
}

const loadAttachments = async (
  paths: string[],
  cidByFilename: Map<string, string>,
  inlineEntries: { path: string, cid: string }[]
): Promise<EmailAttachment[]> => {
  const attachments: EmailAttachment[] = []
  let totalBytes = 0

  for (const path of paths) {
    const buf = await readFile(path)

    totalBytes += buf.byteLength
    const filename = basename(path)
    const att: EmailAttachment = {
      filename,
      content: buf.toString('base64'),
      contentType: guessContentType(path)
    }
    const cid = cidByFilename.get(filename)

    if (cid) {
      att.cid = cid
    }

    attachments.push(att)
  }

  for (const { path, cid } of inlineEntries) {
    const buf = await readFile(path)

    totalBytes += buf.byteLength
    attachments.push({
      filename: basename(path),
      content: buf.toString('base64'),
      contentType: guessContentType(path),
      cid
    })
  }

  if (attachments.length > MAX_ATTACHMENTS) {
    throw new Error(`Too many attachments: ${attachments.length} (max ${MAX_ATTACHMENTS})`)
  }

  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachments exceed ${(MAX_ATTACHMENT_BYTES / 1024 / 1024).toFixed(0)}MB total (${(totalBytes / 1024 / 1024).toFixed(2)}MB)`)
  }

  return attachments
}

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
    attach: { type: 'string', description: 'Attachment file path(s), comma-separated (max 10 files, 10MB total)' },
    'track-open': { type: 'string', description: 'Open tracking: true|false (overrides domain default)' },
    'track-click': { type: 'string', description: 'Click tracking: true|false (overrides domain default)' },
    headers: { type: 'string', description: 'Email headers as a JSON object with string values' },
    cid: { type: 'string', description: 'Mark attached files as inline by filename, "filename:cid" (comma-separated for multiple)' },
    inline: { type: 'string', description: 'Inline attachment(s), "path:cid" (comma-separated for multiple)' },
    'idempotency-key': { type: 'string', description: 'Optional Idempotency-Key header (1-255 chars). Replays the same response on retries within 24h.' },
    'scheduled-at': { type: 'string', description: 'RFC 3339 delivery time, up to 30 days ahead (attachments are not supported)' }
  },
  async run({ args }) {
    let { from, to, subject } = args
    let html = args.html
    let text = args.text

    if (args['html-file']) {
      try {
        html = await readFile(args['html-file'], 'utf-8')
      } catch {
        error(`Cannot read file: ${args['html-file']}`); process.exitCode = 1

        return
      }
    }

    if (args['text-file']) {
      try {
        text = await readFile(args['text-file'], 'utf-8')
      } catch {
        error(`Cannot read file: ${args['text-file']}`); process.exitCode = 1

        return
      }
    }

    if (args['markup-file']) {
      try {
        const raw = await readFile(args['markup-file'], 'utf-8')

        html = render(raw)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''

        error(message || `Cannot read file: ${args['markup-file']}`); process.exitCode = 1

        return
      }
    }

    if (args.markup) {
      html = render(args.markup)
    }

    if (isInteractive() && (!from || !to || !subject)) {
      const client = await createClient(getClientOpts(args))

      if (!from) {
        let domains: Domain[] = []

        try {
          const result = await withSpinner(
            { start: 'Loading verified domains...' },
            () => client.get<{ items: Domain[] }>('/domains')
          )

          domains = result.items.filter((d) => d.verified)
        } catch { /* ignore */ }

        if (domains.length > 0) {
          const domain = domains.length === 1
            ? domains[0]
            : await (async (): Promise<Domain | undefined> => {
              const result = await p.select({
                message: 'Select a verified domain',
                options: domains.map((d) => ({ value: d, label: d.domain }))
              })

              if (p.isCancel(result)) {
                return
              }

              return result
            })()

          if (!domain) {
            return
          }

          const suggestions = SENDER_PREFIXES.map((prefix) => `${prefix}@${domain.domain}`)
          const fromResult = await p.select({
            message: `From address (@${domain.domain})`,
            options: [
              ...suggestions.map((addr) => ({ value: addr, label: addr })),
              { value: '__custom__', label: 'Custom address...' }
            ]
          })

          if (p.isCancel(fromResult)) {
            return
          }

          if (fromResult === '__custom__') {
            const custom = await p.text({
              message: 'From address',
              placeholder: `you@${domain.domain}`,
              validate: (v) => (!v ? 'Required' : undefined)
            })

            if (p.isCancel(custom)) {
              return
            }

            from = custom
          } else {
            from = fromResult as string
          }
        } else {
          const result = await p.text({
            message: 'From',
            placeholder: 'Name <email@domain.com>',
            validate: (v) => (!v ? 'Required' : undefined)
          })

          if (p.isCancel(result)) {
            return
          }

          from = result
        }
      }

      if (!to) {
        const result = await p.text({
          message: 'To',
          placeholder: 'recipient@example.com (comma-separated for multiple)',
          validate: (v) => (!v ? 'Required' : undefined)
        })

        if (p.isCancel(result)) {
          return
        }

        to = result
      }

      if (!subject) {
        const result = await p.text({
          message: 'Subject',
          validate: (v) => (!v ? 'Required' : undefined)
        })

        if (p.isCancel(result)) {
          return
        }

        subject = result as string
      }

      if (!html && !text) {
        const bodyType = await p.select({
          message: 'Body type',
          options: [
            { value: 'text', label: 'Plain text' },
            { value: 'html', label: 'HTML' },
            { value: 'markup', label: 'sevk markup' },
            { value: 'file', label: 'From file (.html or .sevk)' }
          ]
        })

        if (p.isCancel(bodyType)) {
          return
        }

        if (bodyType === 'file') {
          const filePath = await p.text({
            message: 'File path',
            placeholder: 'email.html or email.sevk',
            validate: (v) => (!v ? 'Required' : undefined)
          })

          if (p.isCancel(filePath)) {
            return
          }

          try {
            html = await readFile(filePath, 'utf-8')
          } catch {
            error(`Cannot read file: ${filePath}`); process.exitCode = 1

            return
          }
        } else if (bodyType === 'markup') {
          const content = await p.text({
            message: 'sevk markup',
            placeholder: '<section><heading>Hello</heading><paragraph>World</paragraph></section>'
          })

          if (p.isCancel(content)) {
            return
          }

          html = render(content as string)
        } else if (bodyType === 'html') {
          const content = await p.text({ message: 'HTML body' })

          if (p.isCancel(content)) {
            return
          }

          html = content as string
        } else {
          const content = await p.text({ message: 'Text body' })

          if (p.isCancel(content)) {
            return
          }

          text = content as string
        }
      }
    }

    if (!from || !to || !subject) {
      error('Missing required fields: --from, --to, --subject')
      process.exitCode = 1

      return
    }

    if (!html && !text) {
      error('Missing email body: provide non-empty --html, --text, --markup, --html-file, --text-file, or --markup-file')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const toArray = to.split(',').map((s: string) => s.trim()).filter(Boolean)

    const body: SendEmailRequest = {
      from,
      to: toArray.length === 1 ? toArray[0] : toArray,
      subject
    }

    if (html) {
      body.html = html
    }

    if (text) {
      body.text = text
    }

    if (args['reply-to'] !== undefined) {
      body.reply_to = args['reply-to'].split(',').map((s: string) => s.trim())
    }

    if (args.cc !== undefined) {
      body.cc = args.cc.split(',').map((s: string) => s.trim())
    }

    if (args.bcc !== undefined) {
      body.bcc = args.bcc.split(',').map((s: string) => s.trim())
    }

    if (args['scheduled-at']) {
      body.scheduledAt = args['scheduled-at']
    }

    let cidByFilename: Map<string, string>
    let inlineEntries: { path: string, cid: string }[]

    try {
      cidByFilename = parseCidMap(args.cid)
      inlineEntries = parseInlineEntries(args.inline)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    const attachPaths = splitList(args.attach)

    if (attachPaths.length > 0 || inlineEntries.length > 0) {
      if (body.scheduledAt) {
        error('Attachments are not supported for scheduled email')
        process.exitCode = 1

        return
      }
      try {
        body.attachments = await loadAttachments(attachPaths, cidByFilename, inlineEntries)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : ''

        error(message || 'Failed to load attachments')
        process.exitCode = 1

        return
      }
    }

    let trackOpen: boolean | undefined
    let trackClick: boolean | undefined

    try {
      trackOpen = parseBooleanFlag(args['track-open'], '--track-open')
      trackClick = parseBooleanFlag(args['track-click'], '--track-click')
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    if (trackOpen !== undefined || trackClick !== undefined) {
      const tracking: EmailTracking = {}

      if (trackOpen !== undefined) {
        tracking.open = trackOpen
      }

      if (trackClick !== undefined) {
        tracking.click = trackClick
      }

      body.tracking = tracking
    }

    try {
      if (args.headers !== undefined) {
        body.headers = parseEmailHeaders(JSON.parse(args.headers))
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    const idempotencyKey = validateIdempotencyKey(args['idempotency-key'])
    const extraHeaders = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined

    try {
      const result = await withSpinner(
        body.scheduledAt
          ? { start: 'Scheduling email...', success: 'Email scheduled' }
          : { start: 'Sending email...', success: 'Email sent' },
        () => client.post<SendResponse>('/emails', body, extraHeaders)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        const id = result.id || result.ids?.join(', ')

        success(`Email ${body.scheduledAt ? 'scheduled' : 'sent'} (${id})`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
