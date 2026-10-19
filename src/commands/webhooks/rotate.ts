import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, isInteractive, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface RotateWebhookResponse {
  id: string
  secret: string
}

export default defineCommand({
  meta: { name: 'rotate', description: 'Rotate a webhook signing secret and immediately invalidate the old secret' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Webhook ID', required: true },
    yes: { type: 'boolean', alias: 'y', description: 'Confirm immediate invalidation of the old signing secret' }
  },
  async run({ args }) {
    if (!args.yes) {
      if (!isInteractive() || !process.stdin.isTTY || isJsonOutput(args)) {
        error('The old signing secret will become invalid immediately. Use --yes to confirm rotation.')
        process.exitCode = 1

        return
      }

      const confirm = await p.confirm({
        message: `Rotate webhook ${args.id}? The old signing secret will become invalid immediately. Update your webhook receiver with the new secret.`,
        initialValue: false
      })

      if (p.isCancel(confirm) || !confirm) {
        return
      }
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Rotating signing secret...', success: 'Signing secret rotated' },
        () => client.post<RotateWebhookResponse>(`/webhooks/${args.id}/rotate`)
      )

      if (isJsonOutput(args) || !isInteractive()) {
        json(result)
      } else {
        console.log()
        keyValue([
          ['ID', result.id],
          ['Secret', result.secret]
        ])
        console.log()
        console.log('  Save the secret now and update your webhook receiver. It will not be shown again.')
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
