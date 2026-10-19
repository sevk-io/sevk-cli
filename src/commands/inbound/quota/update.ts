import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface InboundQuota {
  monthlyEmailLimit?: number | null
  monthlyEmailsUsed?: number | null
  resetAt?: string | null
}

export default defineCommand({
  meta: { name: 'update', description: 'Update the inbound monthly quota' },
  args: {
    ...globalArgs,
    'monthly-limit': { type: 'string', description: 'Monthly email limit (positive integer, or "null" to remove the cap)' }
  },
  async run({ args }) {
    const body: { monthlyEmailLimit?: number | null } = {}

    if (args['monthly-limit'] !== undefined) {
      const raw = String(args['monthly-limit']).trim().toLowerCase()

      if (raw === 'null') {
        body.monthlyEmailLimit = null
      } else {
        const n = Number(raw)

        if (!Number.isInteger(n) || n <= 0) {
          error('Invalid --monthly-limit. Use a positive integer or "null".')
          process.exitCode = 1

          return
        }

        body.monthlyEmailLimit = n
      }
    }

    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Updating quota...', success: 'Quota updated' },
        () => client.put<InboundQuota>('/inbound-settings/quota', body)
      )

      if (isJsonOutput(args)) {
        json(quota)

        return
      }

      console.log()
      keyValue([
        ['Monthly limit', quota.monthlyEmailLimit === null || quota.monthlyEmailLimit === undefined ? pc.dim('unlimited') : String(quota.monthlyEmailLimit)],
        ['Used', String(quota.monthlyEmailsUsed ?? 0)],
        ['Reset at', quota.resetAt ? new Date(quota.resetAt).toLocaleString() : '-']
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
