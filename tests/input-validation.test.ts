import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runCliCommand } from './helpers/command'
import { describe, expect, test } from 'bun:test'

import { buildDomainsListQuery } from '../src/commands/domains/list'
import sendEmail from '../src/commands/emails/send'
import { parseActivityActionList } from '../src/lib/activity-action'
import {
  assertCreateBroadcastRelationships,
  assertEstimateBroadcastRelationships,
  assertUpdateBroadcastRelationships,
  parseAbTestConfig
} from '../src/lib/broadcast-input'
import { parseContacts } from '../src/lib/contact-input'
import { parseEmailInput } from '../src/lib/email-input'
import { parseEnumFlag } from '../src/lib/enum-flag'
import { validateIdempotencyKey } from '../src/lib/idempotency-key'
import { parseSegmentDefinition } from '../src/lib/segment-input'
import { parseWebhookEventList } from '../src/lib/webhook-event'

describe('CLI request input validation', () => {
  test('send posts custom headers alongside threading', async () => {
    const custom = { 'X-Ticket-ID': crypto.randomUUID(), 'X-Label': 'Eylül faturası' }
    const result = await runCliCommand(sendEmail, [
      '--from', 'sender@example.com', '--to', 'person@example.com',
      '--subject', 'Receipt', '--text', 'Hello',
      '--headers', JSON.stringify({ 'In-Reply-To': '<parent@example.com>', ...custom })
    ])

    expect(result.exitCode, result.stderr.join('\n')).toBe(0)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].body).toMatchObject({ headers: { 'In-Reply-To': '<parent@example.com>', ...custom } })
    expect(parseEmailInput({
      from: 'sender@example.com', to: 'person@example.com', subject: 'Receipt', text: 'Hello', headers: custom
    }).headers).toEqual(custom)
  })

  test('send rejects non-string custom header values before a request', async () => {
    const result = await runCliCommand(sendEmail, [
      '--from', 'sender@example.com', '--to', 'person@example.com',
      '--subject', 'Receipt', '--text', 'Hello', '--headers', '{"X-ID":42}'
    ])

    expect(result.exitCode).toBe(1)
    expect(result.requests).toHaveLength(0)
  })

  test('parses activity action filters as a non-empty allowlisted array', () => {
    expect(parseActivityActionList('SENT, OPENED')).toEqual(['SENT', 'OPENED'])
    expect(parseActivityActionList('sent, opened')).toEqual(['SENT', 'OPENED'])
    expect(() => parseActivityActionList('')).toThrow('--type must contain only')
    expect(() => parseActivityActionList('SENT,UNKNOWN')).toThrow('--type must contain only')
  })

  test('normalizes enum flags and rejects unsupported values', () => {
    const values = ['HTML', 'MARKUP'] as const

    expect(parseEnumFlag('html', '--style', values, { uppercase: true })).toBe('HTML')
    expect(parseEnumFlag(undefined, '--style', values, { defaultValue: 'HTML' })).toBe('HTML')
    expect(() => parseEnumFlag('', '--style', values, { defaultValue: 'HTML' }))
      .toThrow('--style must be one of: HTML, MARKUP')
    expect(() => parseEnumFlag('text', '--style', values, { uppercase: true }))
      .toThrow('--style must be one of: HTML, MARKUP')
  })

  test('rejects invalid contact payloads before sending them', () => {
    expect(() => parseContacts(
      [{ email: 'person@example.com', subscribed: 'yes' }],
      { max: 10, allowNullData: false }
    )).toThrow('subscribed must be a boolean')

    expect(() => parseContacts(
      [{ email: 'person@example.com', data: null }],
      { max: 10, allowNullData: false }
    )).toThrow('data cannot be null')
  })

  test('rejects malformed email objects before bulk send', () => {
    expect(() => parseEmailInput({
      from: 'sender@example.com',
      to: 'person@example.com',
      subject: 'Hello',
      tracking: { open: 'yes' }
    })).toThrow('tracking.open must be a boolean')

    expect(() => parseEmailInput({
      from: 'sender@example.com',
      to: 'person@example.com'
    })).toThrow('Email subject must be a non-empty string')

    expect(() => parseEmailInput({
      from: 'sender@example.com',
      to: 'person@example.com',
      subject: 'No body'
    })).toThrow('Email must provide a non-empty html, text, or markup body')

    expect(() => parseEmailInput({
      from: 'sender@example.com',
      to: 'person@example.com',
      subject: 'Empty body',
      html: '',
      text: null,
      markup: ''
    })).toThrow('Email must provide a non-empty html, text, or markup body')
  })

  test('keeps both boolean values in the domains verified query', () => {
    expect(buildDomainsListQuery({}, undefined)).toEqual({})
    expect(buildDomainsListQuery({}, true)).toEqual({ verified: 'true' })
    expect(buildDomainsListQuery({}, false)).toEqual({ verified: 'false' })
  })

  test('bulk attachments reject the removed caller-declared size', () => {
    const attachment = {
      filename: 'note.txt',
      content: 'SGVsbG8=',
      contentType: 'text/plain'
    }
    const email = {
      from: 'sender@example.com',
      to: 'person@example.com',
      subject: 'Hello',
      text: 'Hello'
    }

    expect(parseEmailInput({ ...email, attachments: [attachment] }).attachments)
      .toEqual([attachment])
    expect(() => parseEmailInput({
      ...email,
      attachments: [{ ...attachment, size: 5 }]
    })).toThrow('size')
  })

  test('send posts file and inline attachments without caller-declared size', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sevk-cli-attachments-'))
    const path = join(directory, 'note.txt')
    writeFileSync(path, 'Hello')
    try {
      const result = await runCliCommand(sendEmail, [
        '--from', 'sender@example.com', '--to', 'person@example.com',
        '--subject', 'Hello', '--text', 'Hello',
        '--attach', path, '--inline', `${path}:note`
      ])

      expect(result.exitCode, result.stderr.join('\n')).toBe(0)
      expect(result.requests).toHaveLength(1)
      expect(result.requests[0].url.pathname).toBe('/emails')
      expect(result.requests[0].method).toBe('POST')
      expect(result.requests[0].body).toMatchObject({
        attachments: [
          { filename: 'note.txt', content: 'SGVsbG8=', contentType: 'text/plain' },
          { filename: 'note.txt', content: 'SGVsbG8=', contentType: 'text/plain', cid: 'note' }
        ]
      })
      const { attachments } = result.requests[0].body as { attachments: Record<string, unknown>[] }
      for (const attachment of attachments) expect(attachment).not.toHaveProperty('size')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('rejects malformed segment rules', () => {
    expect(() => parseSegmentDefinition({
      rules: [{ field: 'email', operator: 'unknown', value: 'x' }],
      operator: 'AND'
    }, true)).toThrow('invalid operator')

    expect(() => parseSegmentDefinition({
      rules: [],
      operator: 'XOR'
    }, true)).toThrow('operator must be AND or OR')

    expect(() => parseSegmentDefinition({
      rules: [{ field: 'email', operator: 'equals', value: 'x', groupId: 'missing' }],
      operator: 'AND',
      groups: [{ id: 'declared', operator: 'AND' }]
    }, true)).toThrow('Every rule groupId must reference a declared group')

    expect(() => parseSegmentDefinition({
      rules: [{ field: 'email', operator: 'equals', value: 'x', groupId: 'known' }],
      operator: 'AND',
      groups: [{ id: 'known', operator: 'AND' }]
    }, true)).not.toThrow()
  })

  test('rejects incomplete A/B test config', () => {
    expect(() => parseAbTestConfig({
      testPercent: 20
    })).toThrow('evalAfterMinutes must be an integer')
  })

  test('rejects invalid broadcast create relationships', () => {
    const base = {
      name: 'Newsletter',
      subject: 'Hello',
      senderName: 'Sevk',
      domainId: 'domain_1'
    }
    const abTest = { testPercent: 20, evalAfterMinutes: 60 }

    expect(() => assertCreateBroadcastRelationships(base))
      .toThrow('AUDIENCE target requires --audience-id')
    expect(() => assertCreateBroadcastRelationships({
      ...base,
      targetType: 'TOPIC'
    })).toThrow('TOPIC target requires --topic-id')
    expect(() => assertCreateBroadcastRelationships({
      ...base,
      targetType: 'ALL',
      variants: [{ label: 'A', subject: 'A' }]
    })).toThrow('variants and abTest must be provided together')
    expect(() => assertCreateBroadcastRelationships({
      ...base,
      targetType: 'ALL',
      abTest
    })).toThrow('variants and abTest must be provided together')
    expect(() => assertCreateBroadcastRelationships({
      ...base,
      targetType: 'ALL',
      variants: [
        { label: 'same', subject: 'A' },
        { label: 'same', subject: 'B' }
      ],
      abTest
    })).toThrow('Variant labels must be unique')
    expect(() => assertCreateBroadcastRelationships({
      ...base,
      targetType: 'ALL',
      replyTo: 'reply@example.com',
      replyToInbound: true
    })).toThrow('--reply-to and --reply-to-inbound cannot both be set')
  })

  test('rejects invalid broadcast update relationships', () => {
    expect(() => assertUpdateBroadcastRelationships({ audienceId: null }))
      .toThrow('--target-type is required when changing a target id')
    expect(() => assertUpdateBroadcastRelationships({ targetType: 'AUDIENCE' }))
      .toThrow('AUDIENCE target requires --audience-id')
    expect(() => assertUpdateBroadcastRelationships({ targetType: 'TOPIC' }))
      .toThrow('TOPIC target requires --topic-id')
    expect(() => assertUpdateBroadcastRelationships({ targetType: 'SEGMENT' }))
      .toThrow('SEGMENT target requires --segment-id')
    expect(() => assertUpdateBroadcastRelationships({
      variants: null,
      abTest: { testPercent: 20, evalAfterMinutes: 60 }
    })).toThrow('variants: null clears the A/B test')
    expect(() => assertUpdateBroadcastRelationships({
      replyTo: 'reply@example.com',
      replyToInbound: true
    })).toThrow('--reply-to and --reply-to-inbound cannot both be set')
  })

  test('rejects incomplete broadcast recipient estimate targets', () => {
    expect(() => assertEstimateBroadcastRelationships({ targetType: 'AUDIENCE' }))
      .toThrow('AUDIENCE target requires --audience-id')
    expect(() => assertEstimateBroadcastRelationships({ targetType: 'TOPIC' }))
      .toThrow('TOPIC target requires --topic-id')
    expect(() => assertEstimateBroadcastRelationships({ targetType: 'SEGMENT' }))
      .toThrow('SEGMENT target requires --segment-id')
    expect(() => assertEstimateBroadcastRelationships({ targetType: 'ALL' }))
      .not.toThrow()
  })

  test('rejects empty and unknown webhook event names before sending', () => {
    expect(parseWebhookEventList('email.sent, broadcast.finished')).toEqual([
      'email.sent',
      'broadcast.finished'
    ])
    expect(() => parseWebhookEventList('email.sent,totally.invalid'))
      .toThrow('Unsupported webhook event: totally.invalid')
    expect(() => parseWebhookEventList(''))
      .toThrow('must contain at least one event')
  })

  test('enforces the API idempotency-key wire constraints', () => {
    expect(validateIdempotencyKey(undefined)).toBeUndefined()
    expect(validateIdempotencyKey('retry-1')).toBe('retry-1')
    expect(() => validateIdempotencyKey('')).toThrow('between 1 and 255')
    expect(() => validateIdempotencyKey('x'.repeat(256))).toThrow('between 1 and 255')
    expect(() => validateIdempotencyKey('bad\nkey')).toThrow('printable ASCII')
  })

})
