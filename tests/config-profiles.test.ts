import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test
} from 'bun:test'
import { runCommand } from 'citty'

import login from '../src/commands/login'
import {
  getConfigPath,
  getProfileBaseUrl,
  resolveApiKey,
  storeApiKey
} from '../src/lib/config'

const originalFetch = globalThis.fetch
const originalExitCode = process.exitCode
const originalConfigHome = process.env.XDG_CONFIG_HOME
const originalBaseUrl = process.env.SEVK_BASE_URL
let configHome: string

beforeEach(() => {
  configHome = mkdtempSync(join(tmpdir(), 'sevk-profile-test-'))
  process.env.XDG_CONFIG_HOME = configHome
  delete process.env.SEVK_BASE_URL
})

afterEach(() => {
  globalThis.fetch = originalFetch
  process.exitCode = originalExitCode ?? 0
  if (originalConfigHome === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = originalConfigHome
  if (originalBaseUrl === undefined) delete process.env.SEVK_BASE_URL
  else process.env.SEVK_BASE_URL = originalBaseUrl
  rmSync(configHome, { recursive: true, force: true })
})

describe('custom CLI profiles', () => {
  test('uses the configured environment URL with an explicit API-key flag', async () => {
    process.env.SEVK_BASE_URL = 'https://custom.example.com'

    expect(await resolveApiKey({ apiKey: 'sevk_test_key' })).toMatchObject({
      baseUrl: 'https://custom.example.com'
    })
    expect(await resolveApiKey({ apiKey: 'sevk_test_key', baseUrl: 'https://override.example.com' }))
      .toMatchObject({ baseUrl: 'https://override.example.com' })
  })

  test('keeps a profile URL when replacing only its key', async () => {
    await storeApiKey('sevk_old_key', 'custom', 'https://custom.example.com')
    await storeApiKey('sevk_new_key', 'custom')

    expect(await getProfileBaseUrl('custom')).toBe('https://custom.example.com')
    expect((await Bun.file(getConfigPath()).json()).profiles.custom.api_key).toBe('sevk_new_key')
  })

  test('validates re-login against the saved profile URL', async () => {
    await storeApiKey('sevk_old_key', 'custom', 'https://custom.example.com')
    const requests: string[] = []
    globalThis.fetch = (async input => {
      requests.push(String(input))
      return Response.json({ items: [] })
    }) as typeof fetch

    await runCommand(login, {
      rawArgs: ['--key', 'sevk_new_key', '--profile', 'custom', '--json']
    })

    expect(requests).toEqual(['https://custom.example.com/domains?limit=1'])
    expect(await getProfileBaseUrl('custom')).toBe('https://custom.example.com')
    expect((await Bun.file(getConfigPath()).json()).profiles.custom.api_key).toBe('sevk_new_key')
  })
})
