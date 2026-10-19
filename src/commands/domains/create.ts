import * as p from '@clack/prompts'
import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, isInteractive, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Domain {
  id: string
  domain: string
  email: string
  region: string
}

export default defineCommand({
  meta: { name: 'create', description: 'Add a new domain' },
  args: {
    ...globalArgs,
    name: { type: 'string', description: 'Domain name (e.g. example.com)' },
    email: { type: 'string', description: 'Default From address (required)' },
    'sender-name': { type: 'string', description: 'Fallback sender name' },
    region: { type: 'string', description: 'AWS SES region' }
  },
  async run({ args }) {
    let domainName = args.name
    let email = args.email

    if (!domainName && isInteractive()) {
      const result = await p.text({
        message: 'Domain name',
        placeholder: 'example.com',
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      domainName = result
    }

    if (!domainName) {
      error('Domain name is required. Use --name.')
      process.exitCode = 1

      return
    }

    if (!email && isInteractive()) {
      const result = await p.text({
        message: 'Default From email',
        placeholder: `hello@${domainName}`,
        validate: (v) => (!v ? 'Required' : undefined)
      })

      if (p.isCancel(result)) {
        return
      }

      email = result
    }

    if (!email) {
      error('Email is required. Use --email.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, string> = { domain: domainName, email }

    if (args['sender-name'] !== undefined) {
      body.senderName = args['sender-name']
    }

    if (args.region !== undefined) {
      body.region = args.region
    }

    try {
      const domain = await withSpinner(
        { start: 'Creating domain...', success: 'Domain created' },
        () => client.post<Domain>('/domains', body)
      )

      if (isJsonOutput(args)) {
        json(domain)
      } else {
        console.log()
        keyValue([
          ['ID', domain.id],
          ['Domain', domain.domain],
          ['Email', domain.email],
          ['Region', domain.region || '-']
        ])
        console.log()
        console.log('Configure your DNS records to verify this domain.')
        console.log(`Run \`sevk domains dns-records ${domain.id}\` to see the DNS records.`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
