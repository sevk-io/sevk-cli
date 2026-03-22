import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { removeProfile, removeAllProfiles } from '~/lib/config'
import { success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'logout', description: 'Remove saved credentials' },
  args: {
    profile: { type: 'string', description: 'Remove specific profile' },
    all: { type: 'boolean', description: 'Remove all profiles' },
  },
  async run({ args }) {
    if (args.all) {
      if (isInteractive()) {
        const confirm = await p.confirm({ message: 'Remove all saved profiles?' })
        if (p.isCancel(confirm) || !confirm) return
      }
      await removeAllProfiles()
      success('All profiles removed')
      return
    }

    const name = args.profile || 'default'
    if (await removeProfile(name)) {
      success(`Profile "${name}" removed`)
    } else {
      error(`Profile "${name}" not found`)
      process.exitCode = 1; return
    }
  },
})
