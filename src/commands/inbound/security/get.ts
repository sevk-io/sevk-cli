import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
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
  platform: {
    maxAttachmentSizeCap: number
  }
}

export default defineCommand({
  meta: { name: 'get', description: 'Show inbound security config for a domain' },
  args: {
    ...globalArgs,
    'domain-id': { type: 'positional', description: 'Domain ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const cfg = await withSpinner(
        { start: 'Fetching security config...' },
        () => client.get<InboundSecurityConfig>(`/inbound-settings/security/${args['domain-id']}`)
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
      console.log(pc.bold('Platform limits'))
      keyValue([
        ['Max attachment size cap', `${cfg.platform.maxAttachmentSizeCap} bytes`]
      ])

      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
