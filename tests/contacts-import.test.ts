import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  afterEach,
  describe,
  expect,
  test
} from 'bun:test'
import { runCommand } from 'citty'

import importContacts from '../src/commands/contacts/import'

const originalFetch = globalThis.fetch
const originalExitCode = process.exitCode
const directories: string[] = []

afterEach(() => {
  globalThis.fetch = originalFetch
  process.exitCode = originalExitCode ?? 0
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

const importCsv = async (csv: string): Promise<unknown[]> => {
  const directory = mkdtempSync(join(tmpdir(), 'sevk-import-test-'))
  directories.push(directory)
  const file = join(directory, 'contacts.csv')
  writeFileSync(file, csv)
  const requests: unknown[] = []
  globalThis.fetch = (async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)))
    return Response.json({ created: 1, errors: [], contacts: [] })
  }) as typeof fetch

  await runCommand(importContacts, {
    rawArgs: [file, '--api-key', 'sevk_test_key', '--base-url', 'https://api.example.com', '--json']
  })

  return requests
}

describe('contact CSV import', () => {
  test('preserves quoted newlines, commas, and escaped quotes in one contact', async () => {
    const requests = await importCsv('email,notes\r\nperson@example.com,"first, line\r\nsecond ""line"""\r\n')

    expect(requests).toEqual([{
      contacts: [{ email: 'person@example.com', data: { notes: 'first, line\r\nsecond "line"' } }]
    }])
  })

  test('accepts semicolon spreadsheet exports without renaming custom fields', async () => {
    const requests = await importCsv('\ufeffEmail;Subscribed;FirstName\r\nperson@example.com;false;Kubil\r\n')

    expect(requests).toEqual([{
      contacts: [{ email: 'person@example.com', subscribed: false, data: { FirstName: 'Kubil' } }]
    }])
  })

  test('rejects an unterminated quoted field before sending any contacts', async () => {
    const requests = await importCsv('email,notes\nperson@example.com,"unfinished')

    expect(requests).toEqual([])
    expect(process.exitCode).toBe(1)
  })
})
