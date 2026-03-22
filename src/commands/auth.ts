import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { listProfiles, setActiveProfile, removeProfile, renameProfile, maskKey } from '~/lib/config'
import { success, error, json, shouldOutputJson } from '~/lib/output'
import { table } from '~/lib/table'
import pc from 'picocolors'

const list = defineCommand({
  meta: { name: 'list', description: 'List all saved profiles' },
  args: {
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    const profiles = await listProfiles()

    if (profiles.length === 0) {
      if (shouldOutputJson(args)) {
        json([])
      } else {
        console.log('No profiles found. Run `sevk login` to add one.')
      }
      return
    }

    if (shouldOutputJson(args)) {
      json(profiles)
      return
    }

    table(profiles, [
      { key: 'name', label: 'Profile' },
      { key: 'active', label: 'Active', format: (v: boolean) => (v ? pc.green('●') : pc.dim('○')) },
      { key: 'baseUrl', label: 'Base URL', format: (v: string) => v || pc.dim('default') },
    ])
  },
})

const switchProfile = defineCommand({
  meta: { name: 'switch', description: 'Switch active profile' },
  args: {
    name: { type: 'positional', description: 'Profile to activate', required: false },
    json: { type: 'boolean', description: 'Output as JSON' },
  },
  async run({ args }) {
    let name = args.name

    if (!name) {
      const profiles = await listProfiles()
      if (profiles.length === 0) {
        error('No profiles found.')
        process.exitCode = 1; return
      }

      const result = await p.select({
        message: 'Select profile',
        options: profiles.map((pr) => ({
          value: pr.name,
          label: pr.name,
          hint: pr.active ? 'current' : undefined,
        })),
      })

      if (p.isCancel(result)) return
      name = result as string
    }

    if (await setActiveProfile(name)) {
      if (shouldOutputJson(args)) {
        json({ active: name })
      } else {
        success(`Switched to profile "${name}"`)
      }
    } else {
      error(`Profile "${name}" not found`)
      process.exitCode = 1; return
    }
  },
})

const rename = defineCommand({
  meta: { name: 'rename', description: 'Rename a profile' },
  args: {
    old: { type: 'positional', description: 'Current profile name', required: false },
    new: { type: 'positional', description: 'New profile name', required: false },
  },
  async run({ args }) {
    let oldName = args.old
    let newName = args.new

    if (!oldName) {
      const profiles = await listProfiles()
      if (profiles.length === 0) {
        error('No profiles found.')
        process.exitCode = 1; return
      }

      const result = await p.select({
        message: 'Select profile to rename',
        options: profiles.map((pr) => ({ value: pr.name, label: pr.name })),
      })
      if (p.isCancel(result)) return
      oldName = result as string
    }

    if (!newName) {
      const result = await p.text({
        message: 'New name',
        validate: (v) => (!v ? 'Required' : undefined),
      })
      if (p.isCancel(result)) return
      newName = result
    }

    if (await renameProfile(oldName, newName)) {
      success(`Profile "${oldName}" renamed to "${newName}"`)
    } else {
      error(`Cannot rename: "${oldName}" not found or "${newName}" already exists`)
      process.exitCode = 1; return
    }
  },
})

const remove = defineCommand({
  meta: { name: 'remove', description: 'Remove a profile' },
  args: {
    name: { type: 'positional', description: 'Profile to remove', required: false },
  },
  async run({ args }) {
    let name = args.name

    if (!name) {
      const profiles = await listProfiles()
      if (profiles.length === 0) {
        error('No profiles found.')
        process.exitCode = 1; return
      }

      const result = await p.select({
        message: 'Select profile to remove',
        options: profiles.map((pr) => ({ value: pr.name, label: pr.name })),
      })
      if (p.isCancel(result)) return
      name = result as string
    }

    if (await removeProfile(name)) {
      success(`Profile "${name}" removed`)
    } else {
      error(`Profile "${name}" not found`)
      process.exitCode = 1; return
    }
  },
})

export default defineCommand({
  meta: { name: 'auth', description: 'Manage authentication profiles' },
  subCommands: { list, switch: switchProfile, rename, remove },
})
