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
  freeMonthlyInboundEmails?: number | null
  freeEmailsUsed?: number | null
  resetAt?: string | null
  pausedAt?: string | null
  pausedReason?: string | null
  inboundEmailPrice?: number | null
}

export default defineCommand({
  meta: { name: 'get', description: 'Show the inbound monthly quota' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const quota = await withSpinner(
        { start: 'Fetching quota...' },
        () => client.get<InboundQuota>('/inbound-settings/quota')
      )

      if (isJsonOutput(args)) {
        json(quota)

        return
      }

      const limit = quota.monthlyEmailLimit
      const used = quota.monthlyEmailsUsed ?? 0
      const freeLimit = quota.freeMonthlyInboundEmails
      const freeUsed = quota.freeEmailsUsed ?? 0
      const paused = !!quota.pausedAt

      console.log()
      keyValue([
        ['Used (this month)', String(used)],
        ['Monthly limit', limit === null || limit === undefined ? pc.dim('unlimited') : String(limit)],
        ['Free emails used', String(freeUsed)],
        ['Free monthly allowance', freeLimit === null || freeLimit === undefined ? pc.dim('no free tier') : String(freeLimit)],
        ['Reset at', quota.resetAt ? new Date(quota.resetAt).toLocaleString() : '-'],
        ['Paused', paused ? pc.red('Yes') : pc.green('No')],
        ['Paused reason', quota.pausedReason || '-'],
        ['Inbound price (per email)', quota.inboundEmailPrice !== undefined && quota.inboundEmailPrice !== null ? String(quota.inboundEmailPrice) : '-']
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
