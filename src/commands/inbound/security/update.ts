import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { parseBool } from '~/lib/parse'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface InboundSecurityConfig {
  domainId: string
  dmarcStrict?: boolean | null
  spfRequired?: boolean | null
  catchAllEnabled?: boolean | null
  acceptedRecipients: string[]
  maxAttachmentSize?: number | null
  allowedMimeTypes?: string[] | null
}

export default defineCommand({
  meta: { name: 'update', description: 'Update inbound security config for a domain' },
  args: {
    ...globalArgs,
    'domain-id': { type: 'positional', description: 'Domain ID', required: true },
    'dmarc-strict': { type: 'string', description: 'Reject mail failing DMARC: true or false' },
    'spf-required': { type: 'string', description: 'Require SPF pass: true or false' },
    'catch-all': { type: 'string', description: 'Accept any local part: true or false' },
    'accepted-recipients': { type: 'string', description: 'Comma-separated full recipient addresses; used when catch-all is false (empty string clears the list)' },
    'max-attachment-size': { type: 'string', description: 'Max attachment size in bytes' },
    'allowed-mime-types': { type: 'string', description: 'Comma-separated MIME types (use empty string to clear)' },
    'allowed-mime-types-json': { type: 'string', description: 'Exact MIME type array as JSON; preserves commas and whitespace in items' }
  },
  async run({ args }) {
    const body: Record<string, boolean | number | string[]> = {}

    const dmarc = parseBool(args['dmarc-strict'])

    if (args['dmarc-strict'] !== undefined && dmarc === undefined) {
      error('Invalid --dmarc-strict. Use true or false.')
      process.exitCode = 1

      return
    }

    if (dmarc !== undefined) {
      body.dmarcStrict = dmarc
    }

    const spf = parseBool(args['spf-required'])

    if (args['spf-required'] !== undefined && spf === undefined) {
      error('Invalid --spf-required. Use true or false.')
      process.exitCode = 1

      return
    }

    if (spf !== undefined) {
      body.spfRequired = spf
    }

    const catchAll = parseBool(args['catch-all'])

    if (args['catch-all'] !== undefined && catchAll === undefined) {
      error('Invalid --catch-all. Use true or false.')
      process.exitCode = 1

      return
    }

    if (catchAll !== undefined) {
      body.catchAllEnabled = catchAll
    }

    if (args['accepted-recipients'] !== undefined) {
      body.acceptedRecipients = String(args['accepted-recipients']).split(',').map(value => value.trim()).filter(Boolean)
    }

    if (args['max-attachment-size'] !== undefined) {
      const n = Number(args['max-attachment-size'])

      if (!Number.isInteger(n) || n <= 0) {
        error('Invalid --max-attachment-size. Use a positive integer.')
        process.exitCode = 1

        return
      }

      body.maxAttachmentSize = n
    }

    if (args['allowed-mime-types-json'] !== undefined) {
      try {
        const parsed: unknown = JSON.parse(String(args['allowed-mime-types-json']))

        if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
          throw new Error()
        }

        body.allowedMimeTypes = parsed
      } catch {
        error('Invalid --allowed-mime-types-json. Use a JSON array of strings.')
        process.exitCode = 1

        return
      }
    } else if (args['allowed-mime-types'] !== undefined) {
      const raw = String(args['allowed-mime-types']).trim()
      const list = raw === '' ? [] : raw.split(',').map(s => s.trim()).filter(Boolean)

      body.allowedMimeTypes = list
    }

    const client = await createClient(getClientOpts(args))

    try {
      const cfg = await withSpinner(
        { start: 'Updating security config...', success: 'Security config updated' },
        () => client.put<InboundSecurityConfig>(`/inbound-settings/security/${args['domain-id']}`, body)
      )

      if (isJsonOutput(args)) {
        json(cfg)

        return
      }

      const mimeTypes = Array.isArray(cfg.allowedMimeTypes) ? cfg.allowedMimeTypes : []

      console.log()
      keyValue([
        ['Domain ID', cfg.domainId],
        ['DMARC strict', cfg.dmarcStrict ? pc.green('Yes') : pc.red('No')],
        ['SPF required', cfg.spfRequired ? pc.green('Yes') : pc.red('No')],
        ['Catch-all', cfg.catchAllEnabled ? pc.green('Yes') : pc.red('No')],
        ['Accepted recipients', cfg.acceptedRecipients.join(', ') || pc.dim('(none)')],
        ['Max attachment size', cfg.maxAttachmentSize ? `${cfg.maxAttachmentSize} bytes` : '-'],
        ['Allowed MIME types', mimeTypes.length ? mimeTypes.join(', ') : pc.dim('(any)')]
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
