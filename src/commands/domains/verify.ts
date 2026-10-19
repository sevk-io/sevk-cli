import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface Domain {
  domain: string
  verified?: boolean
  verificationToken?: string
}

export default defineCommand({
  meta: { name: 'verify', description: 'Check DKIM status with SES and mark the domain as verified if ready' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Domain ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const domain = await withSpinner(
        { start: 'Checking DKIM status with SES...' },
        () => client.post<Domain>(`/domains/${args.id}/verify`)
      )

      if (!domain.verified) {
        process.exitCode = 1
      }

      if (isJsonOutput(args)) {
        json(domain)

        return
      }

      if (domain.verified) {
        success(`Domain ${pc.bold(domain.domain)} is verified`)
      } else {
        error(`Domain ${domain.domain} is not yet verified`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
