import type { CreateClientOptions } from './client-types'
import { resolveApiKey, validateBaseUrl } from './config'
import { SevkClient } from './sevk-client'

export { DEFAULT_BASE_URL } from './client-config'
export { SevkApiError } from './sevk-api-error'
export { SevkClient } from './sevk-client'

export const createClient = async (
  options: CreateClientOptions
): Promise<SevkClient> => {
  const resolved = await resolveApiKey(options)

  if (!resolved) {
    throw new Error('No API key found. Run `sevk login` or set SEVK_API_KEY environment variable.')
  }

  // Validate every source before sending the bearer key to the resolved host.
  if (resolved.baseUrl) {
    const validationError = validateBaseUrl(resolved.baseUrl)

    if (validationError) {
      throw new Error(`Invalid base URL: ${validationError}`)
    }
  }

  return new SevkClient(resolved.key, resolved.baseUrl)
}
