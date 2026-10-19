export type QueryValue =
  | string
  | number
  | boolean
  | readonly (string | number | boolean)[]
  | undefined

export type QueryParameters = Record<string, QueryValue>

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  query?: QueryParameters
  headers?: Record<string, string>
}

export interface CreateClientOptions {
  apiKey?: string
  baseUrl?: string
  profile?: string
}
