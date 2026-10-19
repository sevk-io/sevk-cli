import { describe, expect, test } from 'bun:test'

import { validateApiKeyAgainstApi } from '../src/lib/auth-validation'
import { SevkApiError } from '../src/lib/sevk-api-error'

const clientThrowing = (error: Error) => ({
  get: async () => { throw error }
})

describe('CLI API-key validation', () => {
  test('accepts successful and capability-limited authenticated keys', async () => {
    expect(await validateApiKeyAgainstApi({ get: async () => ({ items: [] }) }))
      .toBe('authenticated')
    expect(await validateApiKeyAgainstApi(clientThrowing(new SevkApiError(
      'API key does not have required capability: domain:read',
      403,
      'FORBIDDEN'
    )))).toBe('capability-limited')
  })

  test.each([
    new SevkApiError('Invalid API key', 401, 'UNAUTHORIZED'),
    new SevkApiError('API key is suspended', 403, 'FORBIDDEN'),
    new SevkApiError('upstream failed', 502, 'INTERNAL_SERVER_ERROR'),
    new SevkApiError('Request timeout', 0, 'TIMEOUT')
  ])('fails closed for unusable or unverified credentials', async (error) => {
    await expect(validateApiKeyAgainstApi(clientThrowing(error))).rejects.toBe(error)
  })
})
