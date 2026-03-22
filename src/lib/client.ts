import { resolveApiKey } from './config'
import { error } from './output'

export const DEFAULT_BASE_URL = 'https://api.sevk.io'

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: unknown
  query?: Record<string, string | number | undefined>
}

interface ApiError {
  statusCode: number
  message: string
}

export class SevkClient {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  async request<T = unknown>(opts: RequestOptions): Promise<T> {
    let url = `${this.baseUrl}${opts.path}`

    if (opts.query) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined) params.set(key, String(value))
      }
      const qs = params.toString()
      if (qs) url += `?${qs}`
    }

    const res = await fetch(url, {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    })

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`
      try {
        const body = await res.json() as ApiError
        message = body.message || message
      } catch {}
      throw new Error(message)
    }

    if (res.status === 204) return undefined as T

    return res.json() as Promise<T>
  }

  get = <T>(path: string, query?: Record<string, string | number | undefined>) =>
    this.request<T>({ method: 'GET', path, query })

  post = <T>(path: string, body?: unknown) =>
    this.request<T>({ method: 'POST', path, body })

  put = <T>(path: string, body?: unknown) =>
    this.request<T>({ method: 'PUT', path, body })

  delete = <T>(path: string) =>
    this.request<T>({ method: 'DELETE', path })

  async stream(path: string, body?: unknown): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl}${path}`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`
      try {
        const data = await res.json() as ApiError
        message = data.message || message
      } catch {}
      throw new Error(message)
    }

    if (!res.body) {
      throw new Error('No response body')
    }

    return res.body
  }
}

export async function createClient(opts: { apiKey?: string; baseUrl?: string; profile?: string }): Promise<SevkClient> {
  const resolved = await resolveApiKey(opts)

  if (!resolved) {
    throw new Error('No API key found. Run `sevk login` or set SEVK_API_KEY environment variable.')
  }

  return new SevkClient(resolved.key, resolved.baseUrl)
}
