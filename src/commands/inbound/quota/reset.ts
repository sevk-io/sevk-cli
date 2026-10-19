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
  pausedAt?: string | null
}

export default defineCommand({
  meta: { name: 'reset', description: 'Clear the monthly-cap pause and resume inbound processing' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Resetting quota...', success: 'Quota reset' },
        () => client.post<InboundQuota>('/inbound-settings/quota/reset')
      )

      if (isJsonOutput(args)) {
        json(quota)

        return
      }

      console.log()
      keyValue([
        ['Used', String(quota.monthlyEmailsUsed ?? 0)],
        ['Monthly limit', quota.monthlyEmailLimit === null || quota.monthlyEmailLimit === undefined ? pc.dim('unlimited') : String(quota.monthlyEmailLimit)],
        ['Reset at', quota.resetAt ? new Date(quota.resetAt).toLocaleString() : '-'],
        ['Paused', quota.pausedAt ? pc.red('Yes') : pc.green('No')]
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
