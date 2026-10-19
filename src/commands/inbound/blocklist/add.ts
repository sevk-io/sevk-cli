import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

const TYPES = ['EMAIL', 'DOMAIN', 'IP'] as const

interface BlocklistEntry {
  id: string
  type: string
  value: string
  reason?: string | null
}

export default defineCommand({
  meta: { name: 'add', description: 'Add an entry to the inbound blocklist' },
  args: {
    ...globalArgs,
    type: { type: 'string', description: `Entry type: ${TYPES.join('|')}` },
    value: { type: 'string', description: 'Value to block (email, domain, or IP)' },
    reason: { type: 'string', description: 'Reason for blocking' }
  },
  async run({ args }) {
    if (!args.type) {
      error(`Type is required. Use --type ${TYPES.join('|')}.`)
      process.exitCode = 1

      return
    }

    let type: typeof TYPES[number]

    try {
      type = parseEnumFlag(String(args.type), '--type', TYPES, {
        uppercase: true
      })
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    if (!args.value) {
      error('Value is required. Use --value.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))

    const body: Record<string, string> = {
      type,
      value: String(args.value)
    }

    if (args.reason !== undefined) {
      body.reason = String(args.reason)
    }

    try {
      const entry = await withSpinner(
        { start: 'Adding to blocklist...', success: 'Added to blocklist' },
        () => client.post<BlocklistEntry>('/inbound-settings/blocklist', body)
      )

      if (isJsonOutput(args)) {
        json(entry)
      } else {
        console.log()
        keyValue([
          ['ID', entry.id],
          ['Type', entry.type],
          ['Value', entry.value],
          ['Reason', entry.reason || '-']
        ])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
