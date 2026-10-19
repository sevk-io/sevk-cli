import { SevkApiError } from './sevk-api-error'

export type ApiKeyValidation = 'authenticated' | 'capability-limited'

const EXPECTED_AUTHORIZATION_FAILURES = [
  /does not have required capability/i,
  /restricted to a domain/i,
  /cannot access project-global resources/i
]

export const validateApiKeyAgainstApi = async (
  client: { get: (path: string, query?: { limit: number }) => Promise<unknown> }
): Promise<ApiKeyValidation> => {
  try {
    await client.get('/domains', { limit: 1 })

    return 'authenticated'
  } catch (err: unknown) {
    if (
      err instanceof SevkApiError &&
      err.statusCode === 403 &&
      EXPECTED_AUTHORIZATION_FAILURES.some(pattern => pattern.test(err.message))
    ) {
      return 'capability-limited'
    }

    throw err
  }
}
