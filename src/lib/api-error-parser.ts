import { SevkApiError } from './sevk-api-error'

export const parseApiError = (
  raw: unknown,
  statusCode: number,
  headers?: Headers
): SevkApiError => {
  let message = `Request failed with status ${statusCode}`
  let code = 'UNKNOWN_ERROR'
  let fields: Record<string, string[]> | undefined
  let details: unknown

  if (typeof raw === 'string' && raw.trim()) {
    message = raw.trim()
  } else if (raw && typeof raw === 'object') {
    const response = raw as Record<string, unknown>
    const payload = (
      response.error &&
      typeof response.error === 'object' &&
      !Array.isArray(response.error)
        ? response.error
        : response
    ) as Record<string, unknown>

    if (typeof payload.message === 'string' && payload.message) {
      message = payload.message
    }

    if (typeof payload.code === 'string' && payload.code) {
      code = payload.code
    }

    if (
      payload.fields &&
      typeof payload.fields === 'object' &&
      !Array.isArray(payload.fields)
    ) {
      fields = Object.fromEntries(
        Object.entries(payload.fields as Record<string, unknown>).map(
          ([key, value]) => [
            key,
            Array.isArray(value)
              ? value.map(item => String(item))
              : [String(value)]
          ]
        )
      )
    }

    details = payload.details
  }

  const retryAfterHeader = headers?.get('Retry-After')?.trim()
  const retryAfter =
    retryAfterHeader && /^\d+$/.test(retryAfterHeader)
      ? Number(retryAfterHeader)
      : undefined
  const safeRetryAfter =
    retryAfter !== undefined &&
    Number.isSafeInteger(retryAfter) &&
    retryAfter <= 2_147_483_647
      ? retryAfter
      : undefined

  return new SevkApiError(
    message,
    statusCode,
    code,
    fields,
    safeRetryAfter,
    raw,
    details
  )
}
