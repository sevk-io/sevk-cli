import { readFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { parseNullableBooleanFlag } from '~/lib/boolean-flag'
import {
  assertUpdateBroadcastRelationships,
  parseAbTestConfig
} from '~/lib/broadcast-input'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import { parseIntegerFlag } from '~/lib/integer-flag'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { parseVariantFlag, parseVariantsJson } from '~/lib/variant-flag'

interface Variant {
  label: string
  subject?: string
  body?: string
  fromName?: string
}

const BROADCAST_STYLES = ['HTML', 'MARKUP'] as const
const TARGET_TYPES = ['ALL', 'AUDIENCE', 'SEGMENT', 'TOPIC'] as const
const AB_TEST_METRICS = ['CLICK_RATE', 'OPEN_RATE'] as const

export default defineCommand({
  meta: { name: 'update', description: 'Update a draft broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
    name: { type: 'string', description: 'Broadcast name' },
    subject: { type: 'string', description: 'Email subject' },
    'sender-name': { type: 'string', description: 'Sender display name' },
    email: { type: 'string', description: 'From address (full email)' },
    'domain-id': { type: 'string', description: 'Verified domain ID' },
    'reply-to': { type: 'string', description: 'Reply-to email (empty string to clear)' },
    'reply-to-inbound': { type: 'boolean', description: 'Route replies to your inbound address (mutually exclusive with --reply-to)' },
    body: { type: 'string', description: 'Body content (sevk markup or HTML, depending on --style)' },
    'body-file': { type: 'string', description: 'Read body content from file' },
    style: { type: 'string', description: 'Body style: MARKUP or HTML' },
    'target-type': { type: 'string', description: 'Target type: AUDIENCE, TOPIC, SEGMENT, or ALL' },
    'audience-id': { type: 'string', description: 'Target audience ID' },
    'topic-id': { type: 'string', description: 'Target topic ID' },
    'segment-id': { type: 'string', description: 'Target segment ID' },
    'scheduled-at': { type: 'string', description: 'ISO timestamp to schedule the broadcast (empty string to clear)' },
    'include-list-unsubscribe-header': { type: 'boolean', description: 'Toggle RFC 8058 List-Unsubscribe headers' },
    'open-tracking': { type: 'string', description: 'Open tracking: on|off|default (default clears the override)' },
    'click-tracking': { type: 'string', description: 'Click tracking: on|off|default (default clears the override)' },
    'ab-test-percent': { type: 'string', description: 'A/B test sample size as percent (5-50)' },
    'ab-test-eval-minutes': { type: 'string', description: 'A/B test eval window in minutes after the last test send (5-4320)' },
    'ab-test-metric': { type: 'string', description: 'A/B winner metric: open_rate or click_rate' },
    variant: { type: 'string', description: 'Variant JSON object, repeatable. Example: {"label":"A","subject":"Hello"}' },
    'variants-json': { type: 'string', description: 'A/B variants as a JSON array' },
    'ab-test-json': { type: 'string', description: 'Exact A/B config object or null, independent of variants' },
    'remove-ab-test': { type: 'boolean', description: 'Remove the A/B test config and all variants from this draft' }
  },
  async run({ args }) {
    const payload: Record<string, unknown> = {}

    if (args.name !== undefined) {
      payload.name = args.name
    }

    if (args.subject !== undefined) {
      payload.subject = args.subject
    }

    if (args['sender-name'] !== undefined) {
      payload.senderName = args['sender-name']
    }

    if (args.email !== undefined) {
      payload.email = args.email
    }

    if (args['domain-id'] !== undefined) {
      payload.domainId = args['domain-id']
    }

    if (args['reply-to'] !== undefined) {
      payload.replyTo = args['reply-to'] || null
    }

    if (args['reply-to-inbound'] !== undefined) {
      payload.replyToInbound = Boolean(args['reply-to-inbound'])
    }

    if (args.style !== undefined) {
      try {
        payload.style = parseEnumFlag(args.style, '--style', BROADCAST_STYLES, {
          uppercase: true
        })
      } catch (err: unknown) {
        error(err)
        process.exitCode = 1

        return
      }
    }

    if (args['target-type'] !== undefined) {
      try {
        payload.targetType = parseEnumFlag(
          args['target-type'],
          '--target-type',
          TARGET_TYPES,
          { uppercase: true }
        )
      } catch (err: unknown) {
        error(err)
        process.exitCode = 1

        return
      }
    }

    if (args['audience-id'] !== undefined) {
      payload.audienceId = args['audience-id'] || null
    }

    if (args['topic-id'] !== undefined) {
      payload.topicId = args['topic-id'] || null
    }

    if (args['segment-id'] !== undefined) {
      payload.segmentId = args['segment-id'] || null
    }

    if (args['scheduled-at'] !== undefined) {
      payload.scheduledAt = args['scheduled-at']
    }

    if (args['include-list-unsubscribe-header'] !== undefined) {
      payload.includeListUnsubscribeHeader = Boolean(args['include-list-unsubscribe-header'])
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

    if (openTracking !== undefined) {
      payload.openTracking = openTracking
    }

    if (clickTracking !== undefined) {
      payload.clickTracking = clickTracking
    }

    if (args.body !== undefined) {
      payload.body = args.body
    }

    if (args['body-file'] !== undefined) {
      try {
        payload.body = await readFile(args['body-file'], 'utf-8')
      } catch {
        error(`Cannot read file: ${args['body-file']}`); process.exitCode = 1

        return
      }
    }

    const hasOtherAbTestFlags =
      args.variant !== undefined ||
      args['variants-json'] !== undefined ||
      args['ab-test-json'] !== undefined ||
      args['ab-test-percent'] !== undefined ||
      args['ab-test-eval-minutes'] !== undefined ||
      args['ab-test-metric'] !== undefined

    if (args['remove-ab-test'] && hasOtherAbTestFlags) {
      error('--remove-ab-test cannot be combined with variant or A/B config flags')
      process.exitCode = 1

      return
    }

    if (args['remove-ab-test']) {
      payload.variants = null
      payload.abTest = null
    } else {
      let variants: Variant[] | null | undefined

      if (args['variants-json'] !== undefined) {
        try {
          variants = parseVariantsJson(String(args['variants-json']), true)
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

      if (variants !== undefined) {
        payload.variants = variants
      }

      if (args['ab-test-json'] !== undefined) {
        try {
          payload.abTest = parseAbTestConfig(
            JSON.parse(String(args['ab-test-json']))
          )
        } catch {
          error('Invalid --ab-test-json. Use an object or null.')
          process.exitCode = 1

          return
        }
      } else if (
        args['ab-test-percent'] !== undefined ||
        args['ab-test-eval-minutes'] !== undefined ||
        args['ab-test-metric'] !== undefined
      ) {
        try {
          payload.abTest = {
            testPercent: parseIntegerFlag(args['ab-test-percent'], '--ab-test-percent', 20, 5, 50),
            evalAfterMinutes: parseIntegerFlag(args['ab-test-eval-minutes'], '--ab-test-eval-minutes', 240, 5, 4320),
            winnerMetric: parseEnumFlag(
              (args['ab-test-metric'] ?? 'open_rate').replace(/-/g, '_'),
              '--ab-test-metric',
              AB_TEST_METRICS,
              { uppercase: true }
            )
          }
        } catch (err: unknown) {
          error(err)
          process.exitCode = 1

          return
        }
      }
    }

    try {
      assertUpdateBroadcastRelationships(payload)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const broadcast = await withSpinner(
        { start: 'Updating broadcast...', success: 'Broadcast updated' },
        () => client.put<unknown>(`/broadcasts/${args.id}`, payload)
      )

      if (isJsonOutput(args)) {
        json(broadcast)
      } else {
        success('Broadcast updated')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
