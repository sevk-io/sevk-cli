import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Quota {
  limitEmailsUsed?: number
  monthlyRemaining?: number | null
  monthlyEmailsUsed?: number
  effectiveMonthlyEmailLimit?: number | null
  resetAt?: string | null
  pausedAt?: string | null
}

export default defineCommand({
  meta: { name: 'reset', description: 'Resume outbound sending by clearing any pause (including manual_suspend)' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Resuming outbound sending...', success: 'Outbound sending resumed' },
        () => client.post<Quota>('/outbound-settings/quota/reset')
      )

      if (isJsonOutput(args)) {
        json(quota)

        return
      }

      console.log()
      keyValue([
        ['Used (this month)', String(quota.monthlyEmailsUsed ?? 0)],
        ['Used since reset', String(quota.limitEmailsUsed ?? 0)],
        ['Remaining', quota.monthlyRemaining == null ? pc.dim('unlimited') : String(quota.monthlyRemaining)],
        ['Effective limit', quota.effectiveMonthlyEmailLimit === null || quota.effectiveMonthlyEmailLimit === undefined ? pc.dim('unlimited') : String(quota.effectiveMonthlyEmailLimit)],
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
