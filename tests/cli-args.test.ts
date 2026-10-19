import { describe, expect, test } from 'bun:test'
import { defineCommand } from 'citty'

import { assertKnownOptions, normalizeGlobalArgs } from '../src/lib/cli-args'
import { resolveApiKey } from '../src/lib/config'

const command = defineCommand({
  subCommands: {
    domains: defineCommand({
      subCommands: {
        update: defineCommand({
          args: {
            id: { type: 'positional' },
            'open-tracking': { type: 'boolean' },
            'base-url': { type: 'string' },
            'api-key': { type: 'string' },
            profile: { type: 'string', alias: 'p' },
            json: { type: 'boolean' },
            quiet: { type: 'boolean', alias: 'q' }
          }
        })
      }
    })
  }
})

describe('CLI argument boundary', () => {
  test('rejects an explicitly empty API key instead of falling back', async () => {
    await expect(resolveApiKey({ apiKey: '' }))
      .rejects.toThrow('Invalid --api-key')
  })

  test('moves separated and equals-form global flags behind the command path', () => {
    expect(normalizeGlobalArgs([
      '--api-key', 'sevk_test', '--profile=ci', 'domains', 'update', 'domain-1',
      '--base-url', 'https://api.example', '--json'
    ])).toEqual([
      'domains', 'update', 'domain-1',
      '--api-key=sevk_test', '--profile=ci', '--base-url=https://api.example', '--json'
    ])
  })

  test('accepts only options declared by the selected leaf command', () => {
    const valid = normalizeGlobalArgs([
      'domains', 'update', 'domain-1', '--open-tracking', 'false', '--api-key', 'key'
    ])
    expect(() => assertKnownOptions(command, valid)).not.toThrow()

    expect(() => assertKnownOptions(command, [
      'domains', 'update', 'domain-1', '--open-trakcing', 'false'
    ])).toThrow('Unknown option: --open-trakcing')
  })

  test('rejects missing global string values instead of corrupting dispatch', () => {
    expect(() => normalizeGlobalArgs(['--api-key', '--json', 'domains']))
      .toThrow('--api-key requires a value')
  })
})
