import { spyOn } from 'bun:test'
import { type ArgsDef, type CommandDef, runCommand } from 'citty'

import * as output from '../../src/lib/output'

export const runCliCommand = async <Args extends ArgsDef>(command: CommandDef<Args>, args: string[], options?: {
  respond?: () => Response
  interactive?: boolean
  json?: boolean
}) => {
  const requests: { url: URL, method: string, body: Record<string, unknown>, rawBody: string }[] = []
  const stdout: string[] = []
  const stderr: string[] = []
  const previousExitCode = process.exitCode ?? 0
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const request = new Request(input, init)
    const rawBody = await request.text()
    const body = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {}
    requests.push({ url: new URL(request.url), method: request.method, body, rawBody })

    return options?.respond ? options.respond() : Response.json({ id: 'command-result', items: [], ...body })
  }, { preconnect: () => {} }))
  const stdoutSpy = spyOn(console, 'log').mockImplementation((...values) => { stdout.push(Bun.stripANSI(values.join(' '))) })
  const stderrSpy = spyOn(console, 'error').mockImplementation((...values) => { stderr.push(Bun.stripANSI(values.join(' '))) })
  const interactiveSpy = spyOn(output, 'isInteractive').mockReturnValue(options?.interactive ?? false)

  try {
    process.exitCode = 0
    await runCommand(command, {
      rawArgs: [...args, '--api-key=sevk_test_command_fixture', '--base-url=https://api.example.com', ...(options?.json === false ? [] : ['--json'])]
    })

    return { requests, stdout, stderr, exitCode: Number(process.exitCode) }
  } finally {
    process.exitCode = previousExitCode
    fetchSpy.mockRestore()
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
    interactiveSpy.mockRestore()
  }
}
