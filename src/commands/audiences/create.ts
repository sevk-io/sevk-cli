import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import {
  error,
  isInteractive,
  json,
  success
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Audience {
  id: string
}

const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const

export default defineCommand({
  meta: { name: 'create', description: 'Create an audience' },
  args: {
    ...globalArgs,
    name: { type: 'string', description: 'Audience name' },
    description: { type: 'string', description: 'Audience description' },
    'visibility': { type: 'string', description: 'Visibility: PUBLIC or PRIVATE (defaults to PRIVATE)' }
  },
  async run({ args }) {
    let name = args.name

    if (!name && isInteractive()) {
      const result = await p.text({
        message: 'Audience name',
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      name = result
    }

    if (!name) {
      error('Name is required. Use --name.')
      process.exitCode = 1

      return
    }

    let visibility: typeof VISIBILITIES[number] | undefined

    try {
      visibility = parseEnumFlag(args.visibility, '--visibility', VISIBILITIES, {
        uppercase: true
      })
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, string | number | boolean | undefined> = { name }

    if (args.description !== undefined) {
      body.description = args.description
    }

    if (visibility) {
      body.visibility = visibility
    }

    try {
      const audience = await withSpinner(
        { start: 'Creating audience...', success: 'Audience created' },
        () => client.post<Audience>('/audiences', body)
      )

      if (isJsonOutput(args)) {
        json(audience)
      } else {
        success(`Audience created (${audience.id})`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
