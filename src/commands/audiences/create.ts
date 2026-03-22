import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'create', description: 'Create an audience' },
  args: {
    ...globalArgs,
    name: { type: 'string', description: 'Audience name' },
  },
  async run({ args }) {
    let name = args.name

    if (!name && isInteractive()) {
      const result = await p.text({
        message: 'Audience name',
        validate: (v) => (!v ? 'Required' : undefined),
      })
      if (p.isCancel(result)) return
      name = result
    }

    if (!name) {
      error('Name is required. Use --name.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const audience = await withSpinner(
        { start: 'Creating audience...', success: 'Audience created' },
        () => client.post<any>('/audiences', { name }),
      )

      if (isJsonOutput(args)) {
        json(audience)
      } else {
        success(`Audience created (${audience.id})`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
