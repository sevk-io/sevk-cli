import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'delete', description: 'Delete a webhook' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      await withSpinner(
        { start: 'Deleting webhook...', success: 'Webhook deleted' },
        () => client.delete<any>(`/webhooks/${args.id}`),
      )

      if (isJsonOutput(args)) {
        json({ deleted: true, id: args.id })
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
