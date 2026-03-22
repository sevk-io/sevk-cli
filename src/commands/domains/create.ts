import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error, isInteractive } from '~/lib/output'
import { keyValue } from '~/lib/table'

export default defineCommand({
  meta: { name: 'create', description: 'Add a new domain' },
  args: {
    ...globalArgs,
    name: { type: 'string', description: 'Domain name (e.g. example.com)' },
    region: { type: 'string', description: 'AWS SES region' },
  },
  async run({ args }) {
    let domainName = args.name

    if (!domainName && isInteractive()) {
      const result = await p.text({
        message: 'Domain name',
        placeholder: 'example.com',
        validate: (v) => (!v ? 'Required' : undefined),
      })
      if (p.isCancel(result)) return
      domainName = result
    }

    if (!domainName) {
      error('Domain name is required. Use --name.')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = { domain: domainName }
    if (args.region) body.region = args.region

    try {
      const domain = await withSpinner(
        { start: 'Creating domain...', success: 'Domain created' },
        () => client.post<any>('/domains', body),
      )

      if (isJsonOutput(args)) {
        json(domain)
      } else {
        console.log()
        keyValue([
          ['ID', domain.id],
          ['Domain', domain.domain],
          ['Region', domain.region || '—'],
        ])
        console.log()
        console.log('Configure your DNS records to verify this domain.')
        console.log('Run `sevk domains get ' + domain.id + '` to see DNS records.')
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
