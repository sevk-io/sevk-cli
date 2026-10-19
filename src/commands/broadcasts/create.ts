import { readFile } from 'node:fs/promises'

import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { parseNullableBooleanFlag } from '~/lib/boolean-flag'
import { assertCreateBroadcastRelationships } from '~/lib/broadcast-input'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import { parseIntegerFlag } from '~/lib/integer-flag'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { parseVariantFlag, parseVariantsJson } from '~/lib/variant-flag'

interface Domain {
  id: string
  domain: string
  verified?: boolean | null
}

interface Audience {
  id: string
  name: string
  contactsCount?: number | null
}

interface Variant {
  label: string
  subject?: string
  body?: string
  fromName?: string
}

interface CreatedBroadcast {
  id: string
}

const BROADCAST_STYLES = ['HTML', 'MARKUP'] as const
const TARGET_TYPES = ['ALL', 'AUDIENCE', 'SEGMENT', 'TOPIC'] as const
const AB_TEST_METRICS = ['CLICK_RATE', 'OPEN_RATE'] as const

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

export default defineCommand({
  meta: { name: 'create', description: 'Create a broadcast' },
  args: {
    ...globalArgs,
    name: { type: 'string', description: 'Broadcast name' },
    subject: { type: 'string', description: 'Email subject' },
    'sender-email': { type: 'string', description: 'Sender email (must belong to the domain)' },
    'sender-name': { type: 'string', description: 'Sender display name' },
    'domain-id': { type: 'string', description: 'Verified domain ID to send from' },
    'reply-to': { type: 'string', description: 'Reply-to email' },
    'reply-to-inbound': { type: 'boolean', description: 'Route replies to your inbound address (mutually exclusive with --reply-to)' },
    'include-list-unsubscribe-header': { type: 'boolean', description: 'Toggle RFC 8058 List-Unsubscribe headers (default on)' },
    body: { type: 'string', description: 'Body content (sevk markup or HTML, depending on --style)' },
    'body-file': { type: 'string', description: 'Read body content from file' },
    style: { type: 'string', description: 'Body style: MARKUP (default) or HTML' },
    'target-type': { type: 'string', description: 'Target type: AUDIENCE (default), TOPIC, SEGMENT, or ALL' },
    'audience-id': { type: 'string', description: 'Target audience ID (for AUDIENCE)' },
    'topic-id': { type: 'string', description: 'Target topic ID (for TOPIC)' },
    'segment-id': { type: 'string', description: 'Target segment ID (for SEGMENT)' },
    'scheduled-at': { type: 'string', description: 'ISO timestamp to schedule the broadcast' },
    'open-tracking': { type: 'string', description: 'Open tracking: on|off|default (default falls back to domain setting)' },
    'click-tracking': { type: 'string', description: 'Click tracking: on|off|default (default falls back to domain setting)' },
    'ab-test-percent': { type: 'string', description: 'A/B test sample size as percent (5-50, default 20)' },
    'ab-test-eval-minutes': { type: 'string', description: 'A/B test eval window in minutes after the last test send (5-4320, default 240)' },
    'ab-test-metric': { type: 'string', description: 'A/B winner metric: open_rate (default) or click_rate' },
    variant: { type: 'string', description: 'Variant JSON object, repeatable. Example: {"label":"A","subject":"Hello"}' },
    'variants-json': { type: 'string', description: 'A/B variants as a JSON array (e.g. \'[{"label":"A","subject":"Hi"}]\')' }
  },
  async run({ args }) {
    let { name, subject } = args
    let senderEmail = args['sender-email']
    let senderName = args['sender-name']
    let domainId = args['domain-id']
    let body = args.body
    let style: typeof BROADCAST_STYLES[number]
    let targetType: typeof TARGET_TYPES[number]

    try {
      style = parseEnumFlag(args.style, '--style', BROADCAST_STYLES, {
        defaultValue: 'MARKUP',
        uppercase: true
      })
      targetType = parseEnumFlag(args['target-type'], '--target-type', TARGET_TYPES, {
        defaultValue: 'AUDIENCE',
        uppercase: true
      })
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
    let audienceId = args['audience-id']
    const topicId = args['topic-id']
    const segmentId = args['segment-id']

    if (args['body-file']) {
      try {
        body = await readFile(args['body-file'], 'utf-8')
      } catch {
        error(`Cannot read file: ${args['body-file']}`); process.exitCode = 1

        return
      }
    }

    if (isInteractive() && (!name || !subject || !senderEmail || !domainId || !senderName)) {
      const client = await createClient(getClientOpts(args))

      if (!name) {
        const result = await p.text({ message: 'Broadcast name', validate: (v) => (!v ? 'Required' : undefined) })

        if (p.isCancel(result)) {
          return
        }

        name = result
      }

      if (!domainId || !senderEmail) {
        let domains: Domain[] = []

        try {
          const result = await withSpinner(
            { start: 'Loading domains...' },
            () => client.get<{ items: Domain[] }>('/domains')
          )

          domains = result.items.filter((d) => d.verified)
        } catch { /* ignore */ }

        if (domains.length === 0) {
          error('No verified domains found. Add and verify a domain first with `sevk domains create`.')
          process.exitCode = 1

          return
        }

        const domain: Domain | undefined = domains.length === 1
          ? domains[0]
          : await (async () => {
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

        domainId = domain.id

        if (!senderEmail) {
          const suggestions = SENDER_PREFIXES.map((prefix) => `${prefix}@${domain.domain}`)
          const fromResult = await p.select({
            message: `Sender email (@${domain.domain})`,
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
              message: 'Sender email',
              placeholder: `you@${domain.domain}`,
              validate: (v) => (!v ? 'Required' : undefined)
            })

            if (p.isCancel(custom)) {
              return
            }

            senderEmail = custom
          } else {
            senderEmail = fromResult as string
          }
        }
      }

      if (!senderName) {
        const result = await p.text({
          message: 'Sender display name',
          placeholder: 'My App',
          validate: (v) => (!v ? 'Required' : undefined)
        })

        if (p.isCancel(result)) {
          return
        }

        senderName = result
      }

      if (!subject) {
        const result = await p.text({ message: 'Subject', validate: (v) => (!v ? 'Required' : undefined) })

        if (p.isCancel(result)) {
          return
        }

        subject = result as string
      }

      if (targetType === 'AUDIENCE' && !audienceId) {
        let audiences: Audience[] = []

        try {
          const result = await withSpinner(
            { start: 'Loading audiences...' },
            () => client.get<{ items: Audience[] }>('/audiences')
          )

          audiences = result.items
        } catch { /* ignore */ }

        if (audiences.length > 0) {
          const result = await p.select({
            message: 'Target audience',
            options: [
              ...audiences.map((a) => ({
                value: a.id,
                label: a.name,
                hint: a.contactsCount ? `${a.contactsCount} contacts` : undefined
              })),
              { value: '__skip__', label: 'Skip (set later)' }
            ]
          })

          if (p.isCancel(result)) {
            return
          }

          if (result !== '__skip__') {
            audienceId = result as string
          }
        }
      }
    }

    if (!name || !subject || !senderName || !domainId) {
      error('Missing required fields: --name, --subject, --sender-name, --domain-id')
      process.exitCode = 1

      return
    }

    if (targetType === 'AUDIENCE' && !audienceId) {
      error('AUDIENCE target requires --audience-id')
      process.exitCode = 1

      return
    }

    if (targetType === 'TOPIC' && !topicId) {
      error('TOPIC target requires --topic-id')
      process.exitCode = 1

      return
    }

    if (targetType === 'SEGMENT' && !segmentId) {
      error('SEGMENT target requires --segment-id')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const payload: Record<string, unknown> = {
      name,
      subject,
      senderName,
      domainId,
      style,
      targetType
    }

    if (senderEmail) {
      payload.email = senderEmail
    }

    if (args['reply-to']) {
      payload.replyTo = args['reply-to']
    }

    if (args['reply-to-inbound'] !== undefined) {
      payload.replyToInbound = Boolean(args['reply-to-inbound'])
    }

    if (args['include-list-unsubscribe-header'] !== undefined) {
      payload.includeListUnsubscribeHeader = Boolean(args['include-list-unsubscribe-header'])
    }

    if (body !== undefined) {
      payload.body = body
    }

    if (audienceId) {
      payload.audienceId = audienceId
    }

    if (topicId) {
      payload.topicId = topicId
    }

    if (segmentId) {
      payload.segmentId = segmentId
    }

    if (args['scheduled-at']) {
      payload.scheduledAt = args['scheduled-at']
    }

    let openTracking: boolean | null | undefined
    let clickTracking: boolean | null | undefined

    try {
      openTracking = parseNullableBooleanFlag(args['open-tracking'], '--open-tracking')
      clickTracking = parseNullableBooleanFlag(args['click-tracking'], '--click-tracking')
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    if (openTracking !== undefined && openTracking !== null) {
      payload.openTracking = openTracking
    }

    if (clickTracking !== undefined && clickTracking !== null) {
      payload.clickTracking = clickTracking
    }

    let variants: Variant[] | undefined

    if (args['variants-json'] !== undefined) {
      try {
        variants = parseVariantsJson(args['variants-json']) ?? undefined
      } catch {
        error('Invalid --variants-json'); process.exitCode = 1

        return
      }
    } else if (args.variant !== undefined) {
      const list = Array.isArray(args.variant) ? args.variant : [args.variant]

      try {
        variants = list.map(parseVariantFlag)
      } catch (e: unknown) {
        error(e); process.exitCode = 1

        return
      }
    }

    if (variants && (variants.length < 2 || variants.length > 4)) {
      error('A/B tests require 2 to 4 variants')
      process.exitCode = 1

      return
    }

    const hasAbTestFlags =
      args['ab-test-percent'] !== undefined ||
      args['ab-test-eval-minutes'] !== undefined ||
      args['ab-test-metric'] !== undefined

    if (!variants && hasAbTestFlags) {
      error('variants and abTest must be provided together')
      process.exitCode = 1

      return
    }

    if (variants && variants.length > 0) {
      let testPercent: number
      let evalAfterMinutes: number
      try {
        testPercent = parseIntegerFlag(args['ab-test-percent'], '--ab-test-percent', 20, 5, 50)
        evalAfterMinutes = parseIntegerFlag(args['ab-test-eval-minutes'], '--ab-test-eval-minutes', 240, 5, 4320)
      } catch (err: unknown) {
        error(err)
        process.exitCode = 1

        return
      }
      payload.variants = variants
      payload.abTest = {
        testPercent,
        evalAfterMinutes,
        winnerMetric: parseEnumFlag(
          (args['ab-test-metric'] ?? 'open_rate').replace(/-/g, '_'),
          '--ab-test-metric',
          AB_TEST_METRICS,
          { uppercase: true }
        )
      }
    }

    try {
      assertCreateBroadcastRelationships(payload)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    try {
      const broadcast = await withSpinner(
        { start: 'Creating broadcast...', success: 'Broadcast created' },
        () => client.post<CreatedBroadcast>('/broadcasts', payload)
      )

      if (isJsonOutput(args)) {
        json(broadcast)
      } else {
        success(`Broadcast created (${broadcast.id})`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
