import { runCliCommand } from './helpers/command'
import { describe, expect, test } from 'bun:test'

import inboundList from '../src/commands/inbound/list'
import inboundStats from '../src/commands/inbound/stats'

describe('inbound filters', () => {
  test.each([
    [['--is-spam', '--no-is-virus'], { isSpam: 'true', isVirus: 'false' }],
    [['--no-is-spam', '--is-virus'], { isSpam: 'false', isVirus: 'true' }],
    [[], {}]
  ] as const)('preserves flag options %j', async (flags, expected) => {
    const result = await runCliCommand(inboundList, ['--status', 'blocked', ...flags])

    expect(result.exitCode, result.stderr.join('\n')).toBe(0)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].url.pathname).toBe('/inbound')
    expect(Object.fromEntries(result.requests[0].url.searchParams)).toEqual({ limit: '20', status: 'BLOCKED', ...expected })
  })

  test('shows spam and monthly blocklist rejections separately from processing statuses', async () => {
    const result = await runCliCommand(inboundStats, [], {
      json: false,
      respond: () => Response.json({
        total: 49, received: 0, processed: 48, bounced: 0, blocked: 1, spam: 1, failed: 0,
        blocklistRejected: 3,
        counts: { RECEIVED: 0, PROCESSED: 48, BOUNCED: 0, BLOCKED: 1, FAILED: 0 }
      })
    })

    expect(result.exitCode, result.stderr.join('\n')).toBe(0)
    expect(result.requests).toHaveLength(1)
    const output = result.stdout.join('\n')
    expect(output).toMatch(/Total received\s+49/)
    expect(output).toMatch(/Pending\s+0/)
    expect(output).toMatch(/Spam\s+1/)
    expect(output).toMatch(/Blocklist rejected this month\s+3/)
  })
})
