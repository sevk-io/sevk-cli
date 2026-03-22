import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { updateProfileBaseUrl, getProfileBaseUrl, listProfiles } from '~/lib/config'
import { success, error, json, shouldOutputJson, isInteractive } from '~/lib/output'
import { keyValue } from '~/lib/table'
import pc from 'picocolors'

const setUrl = defineCommand({
  meta: { name: 'set-url', description: 'Set API base URL for a profile' },
  args: {
    url: { type: 'positional', description: 'API base URL (e.g. https://api.example.com)', required: false },
    profile: { type: 'string', description: 'Profile to update (default: active profile)' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    let url = args.url

    if (!url && isInteractive()) {
      const currentUrl = await getProfileBaseUrl(args.profile)
      const result = await p.text({
        message: 'API base URL',
        placeholder: 'https://api.example.com',
        initialValue: currentUrl,
        validate: (v) => {
          if (!v) return 'Required'
          try {
            new URL(v)
          } catch {
            return 'Must be a valid URL'
          }
        },
      })
      if (p.isCancel(result)) return
      url = result
    }

    if (!url) {
      error('URL is required.')
      process.exitCode = 1; return
    }

    if (await updateProfileBaseUrl(args.profile || '', url)) {
      if (shouldOutputJson(args)) {
        json({ profile: args.profile || 'active', baseUrl: url })
      } else {
        success(`Base URL set to ${url}`)
      }
    } else {
      error('Profile not found.')
      process.exitCode = 1; return
    }
  },
})

const removeUrl = defineCommand({
  meta: { name: 'remove-url', description: 'Remove custom base URL (revert to default)' },
  args: {
    profile: { type: 'string', description: 'Profile to update (default: active profile)' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    if (await updateProfileBaseUrl(args.profile || '', null)) {
      if (shouldOutputJson(args)) {
        json({ profile: args.profile || 'active', baseUrl: null })
      } else {
        success('Base URL removed, will use default')
      }
    } else {
      error('Profile not found.')
      process.exitCode = 1; return
    }
  },
})

const show = defineCommand({
  meta: { name: 'show', description: 'Show current configuration' },
  args: {
    profile: { type: 'string', description: 'Profile to show (default: active profile)' },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    const profiles = await listProfiles()
    const targetName = args.profile
    const target = targetName
      ? profiles.find((p) => p.name === targetName)
      : profiles.find((p) => p.active)

    if (!target) {
      error(targetName ? `Profile "${targetName}" not found.` : 'No active profile.')
      process.exitCode = 1; return
    }

    if (shouldOutputJson(args)) {
      json(target)
      return
    }

    console.log()
    keyValue([
      ['Profile', target.name],
      ['Active', target.active ? 'Yes' : 'No'],
      ['Base URL', target.baseUrl || pc.dim('https://api.sevk.io (default)')],
    ])
    console.log()
  },
})

export default defineCommand({
  meta: { name: 'config', description: 'Manage CLI configuration' },
  subCommands: { show, 'set-url': setUrl, 'remove-url': removeUrl },
})
