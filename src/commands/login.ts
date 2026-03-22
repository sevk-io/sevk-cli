import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { storeApiKey, maskKey, validateKeyFormat, getConfigPath } from '~/lib/config'
import { SevkClient, DEFAULT_BASE_URL } from '~/lib/client'
import { success, error, json, isInteractive, shouldOutputJson, info } from '~/lib/output'

export default defineCommand({
  meta: { name: 'login', description: 'Save your API key' },
  args: {
    key: { type: 'string', description: 'API key to save' },
    profile: { type: 'string', description: 'Profile name (default: "default")' },
    'base-url': { type: 'string', description: 'API base URL' },
    'skip-validation': { type: 'boolean', description: 'Skip API key validation' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    let apiKey = args.key
    let baseUrl = args['base-url']

    if (isInteractive() && (!apiKey || baseUrl === undefined)) {


      if (!apiKey) {
        const result = await p.password({
          message: 'Enter your API key',
          validate: (v) => v ? (validateKeyFormat(v) || undefined) : 'API key is required',
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
          placeholder: `${DEFAULT_BASE_URL} (press enter for default)`,
        })

        if (p.isCancel(result)) {
          p.cancel('Cancelled')
          return
        }

        if (result) baseUrl = result
      }
    }

    if (!apiKey) {
      error('API key is required. Use --key or run interactively.')
      process.exitCode = 1; return
    }

    // Validate key format
    const formatErr = validateKeyFormat(apiKey)
    if (formatErr) {
      error(formatErr)
      process.exitCode = 1; return
    }

    // Validate key against API (unless skipped)
    if (!args['skip-validation']) {
      const client = new SevkClient(apiKey, baseUrl)
      try {
        await client.get<any>('/domains')
      } catch (err: any) {
        const msg = err.message || ''
        if (msg.includes('401') || msg.includes('Invalid')) {
          error('API key is invalid. Check your key and try again.')
          process.exitCode = 1; return
        }
        // Connection errors are non-fatal (server might be down)
        if (isInteractive()) {
          info(`Could not validate key against API (${msg}). Saving anyway.`)
        }
      }
    }

    const profileName = args.profile || 'default'
    await storeApiKey(apiKey, profileName, baseUrl)

    if (shouldOutputJson(args)) {
      json({
        success: true,
        profile: profileName,
        key: maskKey(apiKey),
        baseUrl: baseUrl || DEFAULT_BASE_URL,
        config_path: getConfigPath(),
      })
    } else {
      success(`API key saved to profile "${profileName}" (${maskKey(apiKey)})`)
      if (baseUrl) info(`Base URL: ${baseUrl}`)
      info(`Config: ${getConfigPath()}`)
    }
  },
})
