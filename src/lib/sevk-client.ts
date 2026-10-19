import { parseApiError } from './api-error-parser'
import { DEFAULT_BASE_URL } from './client-config'
import type { QueryParameters, RequestOptions } from './client-types'
import { validateBaseUrl } from './config'
import { SevkApiError } from './sevk-api-error'

export class SevkClient {
  private static readonly REQUEST_TIMEOUT_MS = 30_000
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(
    apiKey: string,
    baseUrl?: string,
    timeoutMs = SevkClient.REQUEST_TIMEOUT_MS
  ) {
    this.apiKey = apiKey
    const selectedBaseUrl = baseUrl || DEFAULT_BASE_URL
    const validationError = validateBaseUrl(selectedBaseUrl)
    if (validationError) {
      throw new Error(`Invalid base URL: ${validationError}`)
    }
    this.baseUrl = selectedBaseUrl.replace(/\/+$/, '')
    this.timeoutMs = timeoutMs
  }

  async request<T = unknown>(options: RequestOptions): Promise<T> {
    let url = `${this.baseUrl}${options.path}`

    if (options.query) {
      const searchParams = new URLSearchParams()

      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value))
        }
      }

      const queryString = searchParams.toString()

      if (queryString) {
        url += `?${queryString}`
      }
    }

    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeoutMs)

    try {
      const response = await fetch(url, {
        method: options.method,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      })

      if (!response.ok) {
        const text = await response.text()
        controller.signal.throwIfAborted()

        let rawError: unknown = text
        try {
          rawError = JSON.parse(text)
        } catch {
          rawError = text
        }

        throw parseApiError(rawError, response.status, response.headers)
      }

      if (response.status === 204) {
        return undefined as T
      }

      const text = await response.text()
      controller.signal.throwIfAborted()

      let payload: unknown

      try {
        payload = JSON.parse(text)
      } catch {
        payload = undefined
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw parseApiError({
          message: 'Successful API response must be a JSON object',
          code: 'INVALID_RESPONSE'
        }, response.status, response.headers)
      }

      return payload as T
    } catch (err: unknown) {
      if (timedOut && err instanceof Error && (
        err.name === 'AbortError' || err.name === 'TimeoutError'
      )) {
        throw new SevkApiError(
          `Request timeout after ${this.timeoutMs}ms`,
          0,
          'TIMEOUT'
        )
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  get = <T>(
    path: string,
    query?: QueryParameters
  ) => this.request<T>({ method: 'GET', path, query })

  post = <T>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>
  ) => this.request<T>({ method: 'POST', path, body, headers })

  put = <T>(path: string, body?: unknown) =>
    this.request<T>({ method: 'PUT', path, body })

  patch = <T>(path: string, body?: unknown) =>
    this.request<T>({ method: 'PATCH', path, body })

  delete = <T>(path: string) =>
    this.request<T>({ method: 'DELETE', path })
}
