import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface FreeEmails {
  current?: number | null
  limit?: number | null
}

interface OutboundUsage {
  limitEmailsUsed?: number
  monthlyEmailsUsed?: number | null
  effectiveMonthlyEmailLimit?: number | null
  monthlyRemaining?: number | null
  monthlyEmailLimit?: number | null
  adminMonthlyEmailLimit?: number | null
  rateLimit?: number | null
  freeEmails?: FreeEmails | null
  resetAt?: string | number | null
  pausedAt?: string | number | null
  pausedReason?: string | null
}

interface InboundUsage {
  monthlyEmailsUsed?: number | null
  monthlyEmailLimit?: number | null
  monthlyRemaining?: number | null
  freeEmails?: FreeEmails | null
  resetAt?: string | number | null
  pausedAt?: string | number | null
  pausedReason?: string | null
}

interface UsageData {
  balance?: number | string | null
  outboundEmailPrice?: number | string | null
  inboundEmailPrice?: number | string | null
  audiencesCount?: number | null
  audienceLimit?: number | null
  contactsCount?: number | null
  contactLimit?: number | null
  broadcastsCount?: number | null
  broadcastLimit?: number | null
  domainsCount?: number | null
  domainLimit?: number | null
  webhooksCount?: number | null
  webhookLimit?: number | null
  inboundEmailsCount?: number | null
  storageUsed?: string | number | null
  storageLimit?: string | number | null
  outbound?: OutboundUsage | null
  inbound?: InboundUsage | null
}

const formatLimit = (n: number | null | undefined): string => {
  if (n === null) {
    return '∞'
  }

  if (n === undefined) {
    return '-'
  }

  return String(n)
}

const formatUsage = (current: number | null | undefined, limit: number | null | undefined): string => {
  const used = current ?? 0

  return `${used} / ${formatLimit(limit)}`
}

const formatFreeTier = (current: number | null | undefined, limit: number | null | undefined): string => {
  const used = current ?? 0

  if (limit === null || limit === undefined) {
    return `${used} / None`
  }

  return `${used} / ${limit}`
}

const formatBytes = (raw: string | number | null | undefined): string => {
  if (raw === null || raw === undefined) {
    return '∞'
  }

  const n = typeof raw === 'string' ? Number(raw) : raw

  if (!Number.isFinite(n)) {
    return String(raw)
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = n
  let i = 0

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024; i++
  }

  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

export default defineCommand({
  meta: { name: 'usage', description: 'View project usage and limits' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching usage...' },
        () => client.get<UsageData>('/limits')
      )

      if (isJsonOutput(args)) {
        json(data)

        return
      }

      const billingRows: Array<[string, string]> = []

      if (data.balance != null) {
        billingRows.push(['Balance', `$${data.balance}`])
      }

      if (data.outboundEmailPrice != null) {
        billingRows.push(['Email Price', `$${data.outboundEmailPrice}/email`])
      }

      if (data.inboundEmailPrice != null) {
        billingRows.push(['Inbound Price', `$${data.inboundEmailPrice}/email`])
      }

      if (billingRows.length > 0) {
        console.log()
        console.log(pc.bold('  Project Usage'))
        console.log()
        keyValue(billingRows)
      }

      console.log()
      console.log(pc.bold('  Resources'))
      console.log()

      keyValue([
        ['Audiences', formatUsage(data.audiencesCount, data.audienceLimit)],
        ['Contacts', formatUsage(data.contactsCount, data.contactLimit)],
        ['Broadcasts', formatUsage(data.broadcastsCount, data.broadcastLimit)],
        ['Domains', formatUsage(data.domainsCount, data.domainLimit)],
        ['Webhooks', formatUsage(data.webhooksCount, data.webhookLimit)],
        ['Inbound Emails', String(data.inboundEmailsCount ?? 0)],
        ['Storage', `${formatBytes(data.storageUsed)} / ${formatBytes(data.storageLimit)}`]
      ])

      if (data.outbound) {
        const ob = data.outbound

        console.log()
        console.log(pc.bold('  Outbound'))
        console.log()

        const rows: Array<[string, string]> = [
          ['Monthly', formatUsage(ob.monthlyEmailsUsed, ob.adminMonthlyEmailLimit)],
          ['Since reset', formatUsage(ob.limitEmailsUsed, ob.monthlyEmailLimit)],
          ['Remaining', ob.monthlyRemaining == null ? '∞' : String(ob.monthlyRemaining)],
          ['User cap', ob.monthlyEmailLimit == null ? '-' : String(ob.monthlyEmailLimit)],
          ['Admin cap', ob.adminMonthlyEmailLimit == null ? '-' : String(ob.adminMonthlyEmailLimit)],
          ['Rate (per second)', formatLimit(ob.rateLimit)]
        ]

        if (ob.freeEmails) {
          rows.push(['Free Emails', formatFreeTier(ob.freeEmails.current, ob.freeEmails.limit)])
        }

        if (ob.resetAt) {
          rows.push(['Resets', new Date(ob.resetAt).toLocaleString()])
        }

        if (ob.pausedAt) {
          rows.push(['Paused', pc.red(new Date(ob.pausedAt).toLocaleString())])
          if (ob.pausedReason) {
            rows.push(['Reason', ob.pausedReason])
          }
        }

        keyValue(rows)
      }

      if (data.inbound) {
        const ib = data.inbound

        console.log()
        console.log(pc.bold('  Inbound'))
        console.log()

        const rows: Array<[string, string]> = [
          ['Monthly', formatUsage(ib.monthlyEmailsUsed, ib.monthlyEmailLimit)],
          ['Remaining', ib.monthlyRemaining == null ? '∞' : String(ib.monthlyRemaining)]
        ]

        if (ib.freeEmails) {
          rows.push(['Free Emails', formatFreeTier(ib.freeEmails.current, ib.freeEmails.limit)])
        }

        if (ib.resetAt) {
          rows.push(['Resets', new Date(ib.resetAt).toLocaleString()])
        }

        if (ib.pausedAt) {
          rows.push(['Paused', pc.red(new Date(ib.pausedAt).toLocaleString())])
          if (ib.pausedReason) {
            rows.push(['Reason', ib.pausedReason])
          }
        }

        keyValue(rows)
      }

      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
