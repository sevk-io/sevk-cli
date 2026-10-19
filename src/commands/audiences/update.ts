import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Audience {
  id: string
}

const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const

export default defineCommand({
  meta: { name: 'update', description: 'Update an audience' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
    name: { type: 'string', description: 'New name' },
    description: { type: 'string', description: 'New description' },
    'visibility': { type: 'string', description: 'Visibility: PUBLIC or PRIVATE' }
  },
  async run({ args }) {
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

    const body: Record<string, string | number | boolean | undefined> = {}

    if (args.name !== undefined) {
      body.name = args.name
    }

    if (args.description !== undefined) {
      body.description = args.description
    }

    if (visibility) {
      body.visibility = visibility
    }

    const client = await createClient(getClientOpts(args))

    try {
      const audience = await withSpinner(
        { start: 'Updating audience...', success: 'Audience updated' },
        () => client.put<Audience>(`/audiences/${args.id}`, body)
      )

      if (isJsonOutput(args)) {
        json(audience)
      } else {
        success('Audience updated')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
