export class SevkApiError extends Error {
  statusCode: number
  code: string
  fields?: Record<string, string[]>
  retryAfter?: number
  responseBody?: unknown
  details?: unknown

  constructor(
    message: string,
    statusCode: number,
    code: string,
    fields?: Record<string, string[]>,
    retryAfter?: number,
    responseBody?: unknown,
    details?: unknown
  ) {
    super(message)

    this.name = 'SevkApiError'
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
    this.responseBody = responseBody
    this.details = details
  }
}
