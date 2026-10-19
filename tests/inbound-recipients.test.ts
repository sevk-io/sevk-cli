import { runCliCommand } from './helpers/command'
import { expect, test } from 'bun:test'

import updateSecurity from '../src/commands/inbound/security/update'

test.each([
  ['support@inbound.example.com, hello@inbound.example.com', ['support@inbound.example.com', 'hello@inbound.example.com']],
  ['', []]
] as const)('accepted recipient option serializes %j', async (value, expected) => {
  const id = crypto.randomUUID()
  const result = await runCliCommand(updateSecurity, [
    id, '--catch-all', 'false', `--accepted-recipients=${value}`
  ])

  expect(result.exitCode).toBe(0)
  expect(result.requests).toHaveLength(1)
  expect(result.requests[0].method).toBe('PUT')
  expect(result.requests[0].url.pathname).toBe(`/inbound-settings/security/${id}`)
  expect(result.requests[0].body).toEqual({ catchAllEnabled: false, acceptedRecipients: expected })
})
