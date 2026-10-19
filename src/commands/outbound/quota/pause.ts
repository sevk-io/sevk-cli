import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Quota {
  pausedAt?: string | null
  pausedReason?: string | null
  limitEmailsUsed?: number
  monthlyRemaining?: number | null
  monthlyEmailsUsed?: number
  effectiveMonthlyEmailLimit?: number | null
}

export default defineCommand({
  meta: { name: 'pause', description: 'Manually pause outbound transactional sending (does not affect broadcasts)' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Pausing outbound...', success: 'Outbound paused' },
        () => client.post<Quota>('/outbound-settings/quota/pause')
      )

      if (isJsonOutput(args)) {
        json(quota)

        return
      }

      console.log()
      keyValue([
        ['Paused', quota.pausedAt ? pc.red('Yes') : pc.green('No')],
        ['Paused reason', quota.pausedReason || '-'],
        ['Paused at', quota.pausedAt ? new Date(quota.pausedAt).toLocaleString() : '-'],
        ['Used (this month)', String(quota.monthlyEmailsUsed ?? 0)],
        ['Used since reset', String(quota.limitEmailsUsed ?? 0)],
        ['Remaining', quota.monthlyRemaining == null ? pc.dim('unlimited') : String(quota.monthlyRemaining)],
        ['Effective limit', quota.effectiveMonthlyEmailLimit === null || quota.effectiveMonthlyEmailLimit === undefined ? pc.dim('unlimited') : String(quota.effectiveMonthlyEmailLimit)]
      ])
      console.log()
      console.log(pc.dim('  Run `sevk outbound quota reset` to resume.'))
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
