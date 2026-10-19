import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'

import { SevkClient } from '../src/lib/sevk-client'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('SevkClient query serialization', () => {
  test('serializes array-valued query parameters as CSV', async () => {
    let capturedUrl = ''
    globalThis.fetch = (async (input) => {
      capturedUrl = String(input)
      return Response.json({ items: [] })
    }) as typeof fetch
    const client = new SevkClient('sevk_test_key', 'https://api.example.com')

    await client.get('/activity', { type: ['SENT', 'OPENED'] })

    expect(capturedUrl).toBe('https://api.example.com/activity?type=SENT%2COPENED')
  })
})

describe('SevkClient terminal response handling', () => {

  test.each([
    { status: 200, body: '{"items":[]}' },
    { status: 200, body: '' },
    { status: 503, body: '' }
  ])('times out when an aborted JSON body reader returns "$body" with status $status', async ({ status, body }) => {
    let aborted = false
    globalThis.fetch = (async (_input, init) => new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          if (body) controller.enqueue(new TextEncoder().encode(body))
          init?.signal?.addEventListener('abort', () => {
            aborted = true
            controller.close()
          }, { once: true })
        }
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    )) as typeof fetch
    const client = new SevkClient('key', 'https://api.example.com', 5)
    const response = client.get('/contacts')

    await expect(response).rejects.toMatchObject({ statusCode: 0, code: 'TIMEOUT' })
    expect(aborted).toBe(true)
  })

  test.each([
    { status: 200 },
    { status: 503 }
  ])('times out while reading a delayed JSON response body with status $status', async ({ status }) => {
    let bodyTimer: ReturnType<typeof setTimeout> | undefined
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch() {
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"message":'))
            bodyTimer = setTimeout(() => {
              controller.enqueue(new TextEncoder().encode('"delayed"}'))
              controller.close()
            }, 400)
          },
          cancel() {
            if (bodyTimer !== undefined) clearTimeout(bodyTimer)
          }
        }), { status, headers: { 'Content-Type': 'application/json' } })
      }
    })

    try {
      const client = new SevkClient('sevk_test_key', server.url.toString(), 100)
      const response = client.get('/contacts')

      await expect(response).rejects.toMatchObject({ statusCode: 0, code: 'TIMEOUT' })
    } finally {
      if (bodyTimer !== undefined) clearTimeout(bodyTimer)
      await server.stop(true)
    }
  })

  test('times out a stalled handshake', async () => {
    globalThis.fetch = ((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'))
      })
    })) as typeof fetch
    const client = new SevkClient('key', 'https://api.example.com', 5)
    const request = client.get('/projects')

    await expect(request).rejects.toMatchObject({ statusCode: 0, code: 'TIMEOUT' })
  })

  test('does not follow redirects for authenticated JSON requests', async () => {
    let redirect: RequestRedirect | undefined
    globalThis.fetch = (async (_input, init) => {
      redirect = init?.redirect
      return Response.json({ ok: true })
    }) as typeof fetch

    await new SevkClient('sevk_test_key', 'https://api.example.com').get('/projects')

    expect(redirect).toBe('manual')
  })

  test.each([
    { payload: null },
    { payload: [] },
    { payload: 'ok' },
    { payload: 7 },
    { payload: true },
    { payload: undefined }
  ])(
    'rejects invalid successful JSON roots: $payload',
    async ({ payload }) => {
      globalThis.fetch = (async (_input: RequestInfo | URL) => payload === undefined
        ? new Response('not json', { status: 200 })
        : Response.json(payload)) as typeof fetch

      await expect(new SevkClient('key', 'https://api.example.com').get('/projects'))
        .rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    }
  )
})
