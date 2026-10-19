import { runCliCommand } from './helpers/command'
import {
  afterEach,
  describe,
  expect,
  it
} from 'bun:test'

import domainsList from '../src/commands/domains/list'
import { SevkApiError, SevkClient } from '../src/lib/client'
import {
  assertCursorExclusive,
  paginationQuery
} from '../src/lib/pagination'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('CLI pagination', () => {
  it('defaults to cursor mode by omitting page and cursor parameters', async () => {
    const result = await runCliCommand(domainsList, [])

    expect(result.exitCode).toBe(0)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].url.pathname).toBe('/domains')
    expect(Object.fromEntries(result.requests[0].url.searchParams)).toEqual({ limit: '20' })
  })

  it('keeps explicit page requests as offset opt-in', () => {
    expect(paginationQuery({ page: '3', limit: '20' })).toEqual({
      page: '3',
      limit: '20'
    })
  })

  it('forwards cursor requests without page', () => {
    expect(paginationQuery({ after: 'contact_1', limit: 10 })).toEqual({
      after: 'contact_1',
      limit: 10
    })
    expect(paginationQuery({ before: 'contact_2', limit: 10 })).toEqual({
      before: 'contact_2',
      limit: 10
    })
  })

  it('rejects mixed pagination modes before making a request', () => {
    expect(() => assertCursorExclusive({ after: 'a', before: 'b' })).toThrow()
    expect(() => assertCursorExclusive({ page: '2', after: 'a' })).toThrow()
    expect(() => assertCursorExclusive({ page: '2', before: 'b' })).toThrow()
  })

  it('preserves the backend error when explicit offset pagination is disabled', async () => {
    const disabledOffsetFetch: typeof fetch = Object.assign(
      async () => new Response(JSON.stringify({
        error: {
          message: 'Page-based pagination is disabled; use cursor pagination (`after`/`before`)',
          code: 'BAD_REQUEST'
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }),
      { preconnect: originalFetch.preconnect }
    )
    globalThis.fetch = disabledOffsetFetch

    const client = new SevkClient('sevk_test', 'http://localhost:4000')
    const request = client.get('/contacts', paginationQuery({ page: 1, limit: 20 }))

    await expect(request).rejects.toBeInstanceOf(SevkApiError)
    await expect(request).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Page-based pagination is disabled; use cursor pagination (`after`/`before`)'
    })
  })
})
