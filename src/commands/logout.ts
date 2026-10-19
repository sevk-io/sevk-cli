import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { removeAllProfiles, removeProfile } from '~/lib/config'
import {
  error,
  isInteractive,
  json,
  shouldOutputJson,
  success
} from '~/lib/output'

export default defineCommand({
  meta: { name: 'logout', description: 'Remove saved credentials' },
  args: {
    profile: { type: 'string', description: 'Remove specific profile' },
    all: { type: 'boolean', description: 'Remove all profiles' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    if (args.all) {
      if (isInteractive()) {
        const confirm = await p.confirm({ message: 'Remove all saved profiles?' })

        if (p.isCancel(confirm) || !confirm) {
          return
        }
      }

      await removeAllProfiles()
      if (shouldOutputJson(args)) {
        json({ success: true, removed: 'all' })
      } else {
        success('All profiles removed')
      }

      return
    }

    const name = args.profile || 'default'

    if (await removeProfile(name)) {
      if (shouldOutputJson(args)) {
        json({ success: true, removed: name })
      } else {
        success(`Profile "${name}" removed`)
      }
    } else {
      error(`Profile "${name}" not found`)
      process.exitCode = 1

      return
    }
  }
})
