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
  freeMonthlyEmails?: number | null
  freeEmailsUsed?: number
  rateLimit?: number | null
  resetAt?: string | null
  pausedAt?: string | null
  pausedReason?: string | null
  emailPrice?: number | null
}

export default defineCommand({
  meta: { name: 'get', description: 'Show the outbound monthly quota' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Fetching quota...' },
        () => client.get<Quota>('/outbound-settings/quota')
      )

      if (isJsonOutput(args)) {
        json(quota)

        return
      }

      const userLimit = quota.monthlyEmailLimit
      const adminLimit = quota.adminMonthlyEmailLimit
      const effectiveLimit = quota.effectiveMonthlyEmailLimit
      const used = quota.monthlyEmailsUsed ?? 0
      const freeLimit = quota.freeMonthlyEmails
      const freeUsed = quota.freeEmailsUsed ?? 0
      const paused = !!quota.pausedAt

      console.log()
      keyValue([
        ['Used (this month)', String(used)],
        ['Used since reset', String(quota.limitEmailsUsed ?? 0)],
        ['Remaining', quota.monthlyRemaining == null ? pc.dim('unlimited') : String(quota.monthlyRemaining)],
        ['Computed min cap', effectiveLimit === null || effectiveLimit === undefined ? pc.dim('unlimited') : String(effectiveLimit)],
        ['User-set cap', userLimit === null || userLimit === undefined ? pc.dim('none') : String(userLimit)],
        ['Admin ceiling', adminLimit === null || adminLimit === undefined ? pc.dim('none') : String(adminLimit)],
        ['Free emails used', String(freeUsed)],
        ['Free monthly allowance', freeLimit === null || freeLimit === undefined ? pc.dim('no free tier') : String(freeLimit)],
        ['Per-second rate limit', quota.rateLimit === null || quota.rateLimit === undefined ? pc.dim('none') : String(quota.rateLimit)],
        ['Reset at', quota.resetAt ? new Date(quota.resetAt).toLocaleString() : '-'],
        ['Paused', paused ? pc.red('Yes') : pc.green('No')],
        ['Paused reason', quota.pausedReason || '-'],
        ['Email price', quota.emailPrice !== undefined && quota.emailPrice !== null ? String(quota.emailPrice) : '-']
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
