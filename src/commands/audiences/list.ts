import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { table } from '~/lib/table'

export default defineCommand({
  meta: { name: 'list', description: 'List audiences' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Fetching audiences...' },
        () => client.get<any>('/audiences'),
      )

      const audiences = result.items || result

      if (isJsonOutput(args)) {
        json(audiences)
        return
      }

      table(Array.isArray(audiences) ? audiences : [], [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: '_count', label: 'Contacts', format: (v: any) => String(v?.contacts ?? '—') },
        { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() },
      ])
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
