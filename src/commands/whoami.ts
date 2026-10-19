import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { validateApiKeyAgainstApi } from '~/lib/auth-validation'
import { DEFAULT_BASE_URL, SevkClient } from '~/lib/client'
import { maskKey, resolveApiKey } from '~/lib/config'
import { json } from '~/lib/output'
import { keyValue } from '~/lib/table'

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

      process.exitCode = 1

      return
    }

    try {
      await validateApiKeyAgainstApi(new SevkClient(resolved.key, resolved.baseUrl))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (isJsonOutput(args)) {
        json({
          authenticated: false,
          configured: true,
          key: maskKey(resolved.key),
          source: resolved.source,
          baseUrl: resolved.baseUrl || DEFAULT_BASE_URL,
          error: message
        })
      } else {
        console.log(`Credential is configured but could not be authenticated: ${message}`)
      }
      process.exitCode = 1

      return
    }

    if (isJsonOutput(args)) {
      json({
        authenticated: true,
        key: maskKey(resolved.key),
        source: resolved.source,
        baseUrl: resolved.baseUrl || DEFAULT_BASE_URL
      })
    } else {
      console.log()
      keyValue([
        ['Key', maskKey(resolved.key)],
        ['Source', resolved.source],
        ['Base URL', resolved.baseUrl || pc.dim(`${DEFAULT_BASE_URL} (default)`)]
      ])
      console.log()
    }
  }
})
