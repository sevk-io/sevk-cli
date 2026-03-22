import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error, isMenuMode } from '~/lib/output'
import { table } from '~/lib/table'
import { interactivePaginate } from '~/lib/pagination'

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'email', label: 'Email' },
  { key: 'subscribed', label: 'Subscribed', format: (v: boolean) => v ? 'Yes' : 'No' },
  { key: 'createdAt', label: 'Added', format: (v: string) => v ? new Date(v).toLocaleDateString() : '—' },
]

export default defineCommand({
  meta: { name: 'list-contacts', description: 'List contacts in a topic' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    id: { type: 'positional', description: 'Topic ID', required: true },
    page: { type: 'string', description: 'Page number', default: '1' },
    limit: { type: 'string', description: 'Items per page', default: '20' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const endpoint = `/audiences/${args['audience-id']}/topics/${args.id}/contacts`

    if (isJsonOutput(args)) {
      const data = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<any>(endpoint, { page: args.page, limit: args.limit }),
      )
      json(data)
      return
    }

    if (isMenuMode()) {
      await interactivePaginate({
        fetch: (page, limit) => client.get<any>(endpoint, { page, limit }),
        render: (items) => {
          if (items.length === 0) {
            console.log('\n  No contacts in this topic.\n')
            return
          }
          table(items, columns)
        },
        limit: Number(args.limit || 20),
        startPage: Number(args.page || 1),
      })
      return
    }

    try {
      const data = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<any>(endpoint, { page: args.page, limit: args.limit }),
      )
      const items = data.items || data.contacts || []
      if (items.length === 0) {
        console.log('\n  No contacts in this topic.\n')
        return
      }
      table(items, columns)
      console.log(`\n  Page ${data.page || args.page} of ${data.totalPages || '?'} (${data.total || items.length} total)\n`)
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
