import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error } from '~/lib/output'
import { table } from '~/lib/table'

export default defineCommand({
  meta: { name: 'list', description: 'List webhooks' },
  args: { ...globalArgs },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const data = await withSpinner(
        { start: 'Fetching webhooks...' },
        () => client.get<any>('/webhooks'),
      )

      if (isJsonOutput(args)) {
        json(data)
      } else {
        const items = data.items || []

        if (items.length === 0) {
          console.log('\n  No webhooks found.\n')
          return
        }

        console.log()
        table(
          items.map((w: any) => ({
            id: w.id,
            url: w.url,
            events: Array.isArray(w.events) ? w.events.length + ' events' : '—',
            enabled: w.enabled ? 'Yes' : 'No',
          })),
          [
            { key: 'id', label: 'ID' },
            { key: 'url', label: 'URL' },
            { key: 'events', label: 'Events' },
            { key: 'enabled', label: 'Enabled' },
          ],
        )
        console.log()
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
