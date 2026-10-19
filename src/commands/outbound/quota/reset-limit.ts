import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Quota {
  monthlyEmailLimit?: number | null
  limitEmailsUsed?: number
  monthlyRemaining?: number | null
  monthlyEmailsUsed?: number
  effectiveMonthlyEmailLimit?: number | null
  resetAt?: string | null
  pausedAt?: string | null
}

export default defineCommand({
  meta: { name: 'reset-limit', description: 'Reset custom-limit usage while retaining the cap and monthly totals' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Resetting limit usage...', success: 'Limit usage reset' },
        () => client.post<Quota>('/outbound-settings/quota/reset-limit')
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
        ['User-set cap', quota.monthlyEmailLimit == null ? pc.dim('none') : String(quota.monthlyEmailLimit)],
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
