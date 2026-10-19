import {
  assertJsonObject,
  assertOnlyKeys
} from './json-input'

export interface EmailAttachment {
  filename: string
  content: string
  contentType: string
  cid?: string
}

export interface EmailTracking {
  open?: boolean
  click?: boolean
}

export type EmailHeaders = Record<string, string>

export interface EmailRequest {
  from: string
  to: string
  subject: string
  html?: string | null
  text?: string | null
  reply_to?: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  attachments?: EmailAttachment[]
  tracking?: EmailTracking
  headers?: EmailHeaders
}

export type RawEmailInput = EmailRequest & { markup?: string }

const EMAIL_KEYS = [
  'from',
  'to',
  'subject',
  'html',
  'text',
  'reply_to',
  'cc',
  'bcc',
  'attachments',
  'tracking',
  'headers',
  'markup'
] as const

const assertStringList = (
  value: unknown,
  description: string,
  max?: number
): string | string[] => {
  if (typeof value === 'string') return value
  if (
    Array.isArray(value) &&
    (max === undefined || value.length <= max) &&
    value.every(entry => typeof entry === 'string')
  ) return value

  throw new TypeError(`${description} must be a string or string array`)
}

const parseAttachments = (value: unknown): EmailAttachment[] => {
  if (!Array.isArray(value) || value.length > 10) {
    throw new TypeError('attachments must be an array with at most 10 entries')
  }

  return value.map((entry, index) => {
    const attachment = assertJsonObject(entry, `Attachment ${index + 1}`)
    assertOnlyKeys(
      attachment,
      ['filename', 'content', 'contentType', 'cid'],
      `Attachment ${index + 1}`
    )
    for (const field of ['filename', 'content', 'contentType'] as const) {
      if (typeof attachment[field] !== 'string' || attachment[field].length === 0) {
        throw new TypeError(`Attachment ${index + 1} ${field} must be a non-empty string`)
      }
    }
    if (attachment.cid !== undefined && typeof attachment.cid !== 'string') {
      throw new TypeError(`Attachment ${index + 1} cid must be a string`)
    }

    return attachment as unknown as EmailAttachment
  })
}

const parseTracking = (value: unknown): EmailTracking => {
  const tracking = assertJsonObject(value, 'tracking')
  assertOnlyKeys(tracking, ['open', 'click'], 'tracking')
  for (const field of ['open', 'click'] as const) {
    if (tracking[field] !== undefined && typeof tracking[field] !== 'boolean') {
      throw new TypeError(`tracking.${field} must be a boolean`)
    }
  }

  return tracking as EmailTracking
}

export const parseEmailHeaders = (value: unknown): EmailHeaders => {
  const input = assertJsonObject(value, 'headers')
  const headers: EmailHeaders = Object.create(null)

  for (const [name, entry] of Object.entries(input)) {
    if (typeof entry !== 'string') {
      throw new TypeError('headers values must be strings')
    }

    headers[name] = entry
  }

  return headers
}

export const parseEmailInput = (value: unknown): RawEmailInput => {
  const email = assertJsonObject(value, 'Email')
  assertOnlyKeys(email, EMAIL_KEYS, 'Email')

  for (const field of ['from', 'to', 'subject'] as const) {
    if (typeof email[field] !== 'string' || email[field].length === 0) {
      throw new TypeError(`Email ${field} must be a non-empty string`)
    }
  }
  for (const field of ['html', 'text'] as const) {
    if (
      email[field] !== undefined &&
      email[field] !== null &&
      typeof email[field] !== 'string'
    ) {
      throw new TypeError(`Email ${field} must be a string or null`)
    }
  }
  for (const field of ['reply_to', 'cc', 'bcc'] as const) {
    if (email[field] !== undefined) {
      email[field] = assertStringList(email[field], `Email ${field}`, 50)
    }
  }
  if (email.attachments !== undefined) {
    email.attachments = parseAttachments(email.attachments)
  }
  if (email.tracking !== undefined) email.tracking = parseTracking(email.tracking)
  if (email.headers !== undefined) email.headers = parseEmailHeaders(email.headers)
  if (email.markup !== undefined && typeof email.markup !== 'string') {
    throw new TypeError('Email markup must be a string')
  }
  if (!email.html && !email.text && !email.markup) {
    throw new TypeError('Email must provide a non-empty html, text, or markup body')
  }

  return email as unknown as RawEmailInput
}
