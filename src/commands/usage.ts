import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { keyValue } from '~/lib/table'
import pc from 'picocolors'

export default defineCommand({
  meta: { name: 'usage', description: 'View project usage and limits' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching usage...' },
        () => client.get<any>('/limits'),
      )

      if (isJsonOutput(args)) {
        json(data)
        return
      }

      const counts = data._count || {}

      console.log()
      console.log(pc.bold('  Project Usage'))
      console.log()

      keyValue([
        ['Balance', `$${data.balance || '0.0000'}`],
        ['Email Price', `$${data.emailPrice || '0.001000'}/email`],
      ])

      console.log()
      console.log(pc.bold('  Resources'))
      console.log()

      keyValue([
        ['Audiences', `${counts.audiences ?? '—'} / ${data.audienceLimit ?? '∞'}`],
        ['Contacts', `${counts.contacts ?? '—'} / ${data.contactLimit ?? '∞'}`],
        ['Broadcasts', `${counts.broadcasts ?? '—'} / ${data.broadcastLimit ?? '∞'}`],
        ['Domains', `${counts.domains ?? '—'} / ${data.domainLimit ?? '∞'}`],
      ])

      if (data.emailStats) {
        console.log()
        console.log(pc.bold('  Emails'))
        console.log()

        keyValue([
          ['Total', String(data.emailStats.total ?? '—')],
          ['Transactional', String(data.emailStats.transactional ?? '—')],
          ['Marketing', String(data.emailStats.marketing ?? '—')],
        ])
      }

      if (data.emailLimits?.project) {
        const limits = data.emailLimits.project
        console.log()
        console.log(pc.bold('  Rate Limits'))
        console.log()

        keyValue([
          ['Per Second', limits.perSecond ? `${limits.perSecond.used}/${limits.perSecond.limit}` : '—'],
          ['Per Minute', limits.perMinute ? `${limits.perMinute.used}/${limits.perMinute.limit}` : '—'],
          ['Per Hour', limits.perHour ? `${limits.perHour.used}/${limits.perHour.limit}` : '—'],
          ['Per Day', limits.perDay ? `${limits.perDay.used}/${limits.perDay.limit}` : '—'],
        ])
      }

      console.log()
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
