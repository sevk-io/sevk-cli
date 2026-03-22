import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { resolveApiKey, maskKey } from '~/lib/config'
import { json } from '~/lib/output'
import { keyValue } from '~/lib/table'
import pc from 'picocolors'

export default defineCommand({
  meta: { name: 'whoami', description: 'Show current authentication status' },
  args: { ...globalArgs },
  async run({ args }) {
    const resolved = await resolveApiKey(getClientOpts(args))

    if (!resolved) {
      if (isJsonOutput(args)) {
        json({ authenticated: false })
      } else {
        console.log('Not authenticated. Run `sevk login` to get started.')
      }
      process.exitCode = 1; return
    }

    if (isJsonOutput(args)) {
      json({
        authenticated: true,
        key: maskKey(resolved.key),
        source: resolved.source,
        baseUrl: resolved.baseUrl || 'https://api.sevk.io',
      })
    } else {
      console.log()
      keyValue([
        ['Key', maskKey(resolved.key)],
        ['Source', resolved.source],
        ['Base URL', resolved.baseUrl || pc.dim('https://api.sevk.io (default)')],
      ])
      console.log()
    }
  },
})
