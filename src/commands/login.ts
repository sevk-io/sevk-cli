import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { validateApiKeyAgainstApi } from '~/lib/auth-validation'
import { DEFAULT_BASE_URL, SevkApiError, SevkClient } from '~/lib/client'
import {
  getConfigPath,
  getProfileBaseUrl,
  maskKey,
  storeApiKey,
  validateBaseUrl,
  validateKeyFormat
} from '~/lib/config'
import {
  error,
  info,
  isInteractive,
  json,
  shouldOutputJson,
  success
} from '~/lib/output'

export default defineCommand({
  meta: { name: 'login', description: 'Save your API key' },
  args: {
    key: { type: 'string', description: 'API key to save' },
    profile: { type: 'string', description: 'Profile name (default: "default")' },
    'base-url': { type: 'string', description: 'API base URL' },
    'skip-validation': { type: 'boolean', description: 'Skip API key validation' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const profileName = args.profile || 'default'
    let apiKey = args.key
    let baseUrl = args['base-url'] ?? process.env.SEVK_BASE_URL ?? await getProfileBaseUrl(profileName)

    if (isInteractive() && (!apiKey || baseUrl === undefined)) {

      if (!apiKey) {
        const result = await p.password({
          message: 'Enter your API key',
          validate: (v) => v ? (validateKeyFormat(v) || undefined) : 'API key is required'
        })

        if (p.isCancel(result)) {
          p.cancel('Cancelled')

          return
        }

        apiKey = result
      }

      if (!baseUrl) {
        const result = await p.text({
          message: 'API base URL',
          placeholder: `${DEFAULT_BASE_URL} (press enter for default)`
        })

        if (p.isCancel(result)) {
          p.cancel('Cancelled')

          return
        }

        if (result) {
          baseUrl = result
        }
      }
    }

    if (apiKey) {
      apiKey = apiKey.trim()
    }

    if (!apiKey) {
      error('API key is required. Use --key or run interactively.')
      process.exitCode = 1

      return
    }

    const formatErr = validateKeyFormat(apiKey)

    if (formatErr) {
      error(formatErr)
      process.exitCode = 1

      return
    }

    if (baseUrl) {
      const urlErr = validateBaseUrl(baseUrl)

      if (urlErr) {
        error(urlErr)
        process.exitCode = 1

        return
      }
    }

    if (!args['skip-validation']) {
      const client = new SevkClient(apiKey, baseUrl)

      try {
        const validation = await validateApiKeyAgainstApi(client)
        if (validation === 'capability-limited' && isInteractive()) {
          info('API key is valid but cannot list domains with its current scope. Saving it anyway.')
        }
      } catch (err: unknown) {
        const statusCode = err instanceof SevkApiError ? err.statusCode : undefined

        if (statusCode === 401) {
          error('API key is invalid. Check your key and try again.')
          process.exitCode = 1

          return
        }

        error(statusCode === 403
          ? 'API key is not currently usable (it may be suspended).'
          : err)
        process.exitCode = 1

        return
      }
    }

    await storeApiKey(apiKey, profileName, baseUrl)

    if (shouldOutputJson(args)) {
      json({
        success: true,
        profile: profileName,
        key: maskKey(apiKey),
        baseUrl: baseUrl || DEFAULT_BASE_URL,
        config_path: getConfigPath()
      })
    } else {
      success(`API key saved to profile "${profileName}" (${maskKey(apiKey)})`)
      if (baseUrl) {
        info(`Base URL: ${baseUrl}`)
      }

      info(`Config: ${getConfigPath()}`)
    }
  }
})
