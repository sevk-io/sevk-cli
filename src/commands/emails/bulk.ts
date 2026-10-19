import { readFile } from 'node:fs/promises'

import { render } from 'sevk'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { parseBooleanFlag } from '~/lib/boolean-flag'
import { createClient } from '~/lib/client'
import {
  type EmailRequest,
  type EmailTracking,
  parseEmailInput,
  type RawEmailInput
} from '~/lib/email-input'
import { validateIdempotencyKey } from '~/lib/idempotency-key'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface BulkResponse {
  success: number
  failed: number
  ids: string[]
  errors?: { index: number, email: string, error: string }[]
}

export default defineCommand({
  meta: { name: 'bulk', description: 'Send bulk emails from a JSON file' },
  args: {
    ...globalArgs,
    file: { type: 'positional', description: 'Path to JSON file with emails array', required: true },
    'track-open': { type: 'string', description: 'Open tracking default for all emails: true|false' },
    'track-click': { type: 'string', description: 'Click tracking default for all emails: true|false' },
    'idempotency-key': { type: 'string', description: 'Optional Idempotency-Key header for the batch (1-255 chars). Replays the same response on retries within 24h.' }
  },
  async run({ args }) {
    let rawEmails: RawEmailInput[]

    try {
      const raw = await readFile(args.file, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      const candidate = Array.isArray(parsed)
        ? parsed
        : (parsed as { emails?: unknown }).emails

      if (!Array.isArray(candidate)) {
        error('JSON must be an array of emails or { emails: [...] }')
        process.exitCode = 1

        return
      }

      if (candidate.length === 0 || candidate.length > 100) {
        throw new TypeError('emails must contain between 1 and 100 entries')
      }

      rawEmails = candidate.map(parseEmailInput)
    } catch (err: unknown) {
      error(`Cannot read or parse file: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1

      return
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
    const hasTrackingDefaults = trackOpen !== undefined || trackClick !== undefined

    try {
      const emails: EmailRequest[] = rawEmails.map((email) => {
        const { markup, ...next } = email
        if (markup) {
          next.html = render(markup)
        }

        if (hasTrackingDefaults) {
          const tracking: EmailTracking = { ...next.tracking }

          if (trackOpen !== undefined && tracking.open === undefined) {
            tracking.open = trackOpen
          }

          if (trackClick !== undefined && tracking.click === undefined) {
            tracking.click = trackClick
          }

          next.tracking = tracking
        }

        return next
      })
      const client = await createClient(getClientOpts(args))
      const idempotencyKey = validateIdempotencyKey(args['idempotency-key'])
      const extraHeaders = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      const result = await withSpinner(
        {
          start: `Sending ${emails.length} emails...`,
          success: (r: BulkResponse) => `${r.success} sent, ${r.failed} failed`
        },
        () => client.post<BulkResponse>('/emails/bulk', { emails }, extraHeaders)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${result.success} sent, ${result.failed} failed`)
        if (result.errors?.length) {
          for (const err of result.errors) {
            console.log(`  ${err.email}: ${err.error}`)
          }
        }
      }
      if (result.failed > 0 || (result.errors?.length ?? 0) > 0) {
        process.exitCode = 1
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
