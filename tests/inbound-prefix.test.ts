import { runCliCommand } from './helpers/command'
import { expect, test } from 'bun:test'

import updateDomain from '../src/commands/domains/update'

test.each(['gelen', ''])('domain update preserves the %j receiving prefix', async prefix => {
  const id = crypto.randomUUID()
  const result = await runCliCommand(updateDomain, [id, `--inbound-prefix=${prefix}`])

  expect(result.exitCode).toBe(0)
  expect(result.requests).toHaveLength(1)
  expect(result.requests[0].method).toBe('PUT')
  expect(result.requests[0].url.pathname).toBe(`/domains/${id}`)
  expect(result.requests[0].body).toEqual({ inboundPrefix: prefix })
})
