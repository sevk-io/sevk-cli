import * as prompts from '@clack/prompts'
import { runCliCommand } from './helpers/command'
import {
  describe,
  expect,
  spyOn,
  test
} from 'bun:test'

import rotate from '../src/commands/webhooks/rotate'

describe('webhook secret rotation', () => {
  test.each([{ flags: [] }, { flags: ['--yes=false'] }])('requires explicit confirmation without a terminal: %j', async ({ flags }) => {
    const result = await runCliCommand(rotate, [crypto.randomUUID(), ...flags])

    expect(result.exitCode).toBe(1)
    expect(result.requests).toHaveLength(0)
    expect(result.stdout).toHaveLength(0)
    expect(result.stderr.join('\n')).toContain('--yes')
  })

  test.each(['--yes', '-y'])('returns the entire new secret with %s and sends one bodyless POST', async flag => {
    const id = crypto.randomUUID()
    const secret = `whsec_${Buffer.from(crypto.randomUUID().repeat(4)).toString('base64')}`
    const result = await runCliCommand(rotate, [id, flag], {
      respond: () => Response.json({ id, secret })
    })

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toHaveLength(0)
    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].method).toBe('POST')
    expect(result.requests[0].url.pathname).toBe(`/webhooks/${id}/rotate`)
    expect(result.requests[0].rawBody).toBe('')
    expect(JSON.parse(result.stdout.join('\n'))).toEqual({ id, secret })
  })

  test.each([403, 404, 503])('preserves a %i error without retrying or printing a secret', async status => {
    const result = await runCliCommand(rotate, [crypto.randomUUID(), '--yes'], {
      respond: () => Response.json({ code: 'ROTATION_FAILED', message: 'Rotation failed' }, { status })
    })

    expect(result.exitCode).toBe(1)
    expect(result.requests).toHaveLength(1)
    expect(result.stdout).toHaveLength(0)
    expect(JSON.parse(result.stderr.join('\n')).error).toMatchObject({ statusCode: status, code: 'ROTATION_FAILED' })
  })

  test('does not retry a lost response', async () => {
    const result = await runCliCommand(rotate, [crypto.randomUUID(), '--yes'], {
      respond: () => { throw new Error('Connection lost') }
    })

    expect(result.exitCode).toBe(1)
    expect(result.requests).toHaveLength(1)
    expect(result.stdout).toHaveLength(0)
  })

  test('does not send a request when the confirmation is declined', async () => {
    const tty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true })
    const confirm = spyOn(prompts, 'confirm').mockResolvedValue(false)

    try {
      const result = await runCliCommand(rotate, [crypto.randomUUID()], { interactive: true, json: false })

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ initialValue: false }))
      expect(result.exitCode).toBe(0)
      expect(result.requests).toHaveLength(0)
      expect(result.stdout).toHaveLength(0)
    } finally {
      confirm.mockRestore()
      if (tty) Object.defineProperty(process.stdin, 'isTTY', tty)
      else Reflect.deleteProperty(process.stdin, 'isTTY')
    }
  })
})
