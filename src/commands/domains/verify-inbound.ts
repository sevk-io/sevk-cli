import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue, table } from '~/lib/table'

interface Domain {
  domain: string
  inboundVerified?: boolean
  inboundExpectedTarget?: string | null
  inboundMxResolved?: { exchange: string, priority: number }[]
}

export default defineCommand({
  meta: { name: 'verify-inbound', description: 'Check inbound MX records and mark the domain as inbound-verified if they match' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const domain = await withSpinner(
        { start: 'Checking inbound MX records...' },
        () => client.post<Domain>(`/domains/${args.id}/inbound/verify`)
      )

      if (!domain.inboundVerified) {
        process.exitCode = 1
      }

      if (isJsonOutput(args)) {
        json(domain)

        return
      }

      const resolved: Array<{ exchange: string, priority: number }> = Array.isArray(domain.inboundMxResolved)
        ? domain.inboundMxResolved
        : []
      const expected: string = domain.inboundExpectedTarget || '-'

      console.log()
      keyValue([
        ['Domain', domain.domain],
        ['Inbound verified', domain.inboundVerified ? pc.green('Yes') : pc.red('No')],
        ['Expected MX target', expected]
      ])

      console.log()
      console.log(pc.bold('Resolved MX records'))
      if (resolved.length === 0) {
        console.log(pc.dim('  No MX records resolved.'))
      } else {
        table(resolved, [
          { key: 'priority', label: 'Priority' },
          { key: 'exchange', label: 'Exchange' }
        ])
      }

      console.log()

      if (domain.inboundVerified) {
        success(`Domain ${pc.bold(domain.domain)} is inbound-verified`)
      } else {
        const foundTargets = resolved.map(r => r.exchange).join(', ') || 'none'

        error(`MX mismatch. Expected: ${expected}. Found: ${foundTargets}`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
