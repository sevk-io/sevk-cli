import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'verify', description: 'Trigger domain verification' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Verifying domain...', success: 'Verification triggered' },
        () => client.post<any>(`/domains/${args.id}/verify`),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success('Domain verification triggered. Check back in a few minutes.')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
