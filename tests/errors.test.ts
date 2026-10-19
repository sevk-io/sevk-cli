import { describe, expect, it } from 'bun:test'

import { parseApiError } from '../src/lib/api-error-parser'

describe('API errors', () => {
  it('keeps transport status and structured metadata', () => {
    const error = parseApiError(
      {
        statusCode: 500,
        code: 'TOO_MANY_REQUESTS',
        message: 'slow down',
        fields: { email: 'invalid' },
        details: { provider: 'limited' }
      },
      429,
      new Headers({ 'Retry-After': '7' })
    )

    expect(error.statusCode).toBe(429)
    expect(error.code).toBe('TOO_MANY_REQUESTS')
    expect(error.fields).toEqual({ email: ['invalid'] })
    expect(error.details).toEqual({ provider: 'limited' })
    expect(error.retryAfter).toBe(7)
  })

  it('parses the internal error branch', () => {
    const body = { error: 'Payload Too Large', message: 'body too large' }
    const error = parseApiError(body, 413)

    expect(error.statusCode).toBe(413)
    expect(error.code).toBe('UNKNOWN_ERROR')
    expect(error.message).toBe('body too large')
    expect(error.responseBody).toBe(body)
  })

  it('rejects invalid Retry-After values', () => {
    for (const value of ['-1', 'Wed, 21 Oct 2015 07:28:00 GMT', '2147483648']) {
      const error = parseApiError(
        { message: 'slow down' },
        429,
        new Headers({ 'Retry-After': value })
      )

      expect(error.retryAfter).toBeUndefined()
    }
  })

  it('falls back for empty messages and preserves scalar bodies', () => {
    expect(parseApiError({ message: '' }, 500).message).toBe('Request failed with status 500')
    expect(parseApiError('plain failure', 502).message).toBe('plain failure')
    expect(parseApiError(null, 500).responseBody).toBeNull()
    expect(parseApiError([1, 2], 500).responseBody).toEqual([1, 2])
  })
})
