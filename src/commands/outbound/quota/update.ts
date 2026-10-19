import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Quota {
  monthlyEmailLimit?: number | null
  adminMonthlyEmailLimit?: number | null
  effectiveMonthlyEmailLimit?: number | null
  limitEmailsUsed?: number
  monthlyRemaining?: number | null
  monthlyEmailsUsed?: number
  pausedAt?: string | null
  resetAt?: string | null
}

export default defineCommand({
  meta: { name: 'update', description: 'Update the outbound monthly quota (user-set cap)' },
  args: {
    ...globalArgs,
    'monthly-limit': { type: 'string', description: 'Monthly email limit (positive integer, or "null" to remove the user-set cap)' }
  },
  async run({ args }) {
    if (args['monthly-limit'] === undefined) {
      error('No fields to update. Use --monthly-limit <number|null>.')
      process.exitCode = 1

      return
    }

    const raw = String(args['monthly-limit']).trim().toLowerCase()
    let monthlyEmailLimit: number | null

    if (raw === 'null') {
      monthlyEmailLimit = null
    } else {
      const n = Number(raw)

      if (!Number.isInteger(n) || n <= 0) {
        error('Invalid --monthly-limit. Use a positive integer or "null".')
        process.exitCode = 1

        return
      }

      monthlyEmailLimit = n
    }

    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Updating quota...', success: 'Quota updated' },
        () => client.put<Quota>('/outbound-settings/quota', { monthlyEmailLimit })
      )

      if (isJsonOutput(args)) {
        json(quota)

        return
      }

      console.log()
      keyValue([
        ['User-set cap', quota.monthlyEmailLimit === null || quota.monthlyEmailLimit === undefined ? pc.dim('none') : String(quota.monthlyEmailLimit)],
        ['Admin ceiling', quota.adminMonthlyEmailLimit === null || quota.adminMonthlyEmailLimit === undefined ? pc.dim('none') : String(quota.adminMonthlyEmailLimit)],
        ['Effective limit', quota.effectiveMonthlyEmailLimit === null || quota.effectiveMonthlyEmailLimit === undefined ? pc.dim('unlimited') : String(quota.effectiveMonthlyEmailLimit)],
        ['Used (this month)', String(quota.monthlyEmailsUsed ?? 0)],
        ['Used since reset', String(quota.limitEmailsUsed ?? 0)],
        ['Remaining', quota.monthlyRemaining == null ? pc.dim('unlimited') : String(quota.monthlyRemaining)],
        ['Paused', quota.pausedAt ? pc.red('Yes') : pc.green('No')],
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
