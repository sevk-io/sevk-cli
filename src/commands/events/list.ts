import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error, isMenuMode } from '~/lib/output'
import { table } from '~/lib/table'
import { interactivePaginate } from '~/lib/pagination'

const columns = [
  { key: 'action', label: 'Action' },
  { key: 'contact', label: 'Contact' },
  { key: 'description', label: 'Description' },
  { key: 'createdAt', label: 'Date' },
]

function mapItems(items: any[]) {
  return items.map((e: any) => ({
    action: e.action || e.eventType,
    contact: e.contact || '—',
    description: e.description || '—',
    createdAt: e.createdAt ? new Date(e.createdAt).toLocaleString() : '—',
  }))
}

export default defineCommand({
  meta: { name: 'list', description: 'List project events' },
  args: {
    ...globalArgs,
    category: { type: 'string', description: 'Filter by category (EMAIL, SUBSCRIPTION)' },
    type: { type: 'string', description: 'Filter by action (SENT, DELIVERED, OPENED, CLICKED, BOUNCED)' },
    days: { type: 'string', description: 'Show events from last N days' },
    search: { type: 'string', description: 'Search by email, subject, or broadcast name' },
    page: { type: 'string', description: 'Page number', default: '1' },
    limit: { type: 'string', description: 'Items per page', default: '20' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    const params: Record<string, string> = {}
    if (args.category) params.category = args.category
    if (args.type) params.type = args.type
    if (args.days) params.days = args.days
    if (args.search) params.search = args.search

    if (isJsonOutput(args)) {
      const data = await withSpinner(
        { start: 'Fetching events...' },
        () => client.get<any>('/events', { ...params, page: args.page, limit: args.limit }),
      )
      json(data)
      return
    }

    if (isMenuMode()) {
      await interactivePaginate({
        fetch: (page, limit) => client.get<any>('/events', { ...params, page, limit }),
        render: (items) => {
          if (items.length === 0) {
            console.log('\n  No events found.\n')
            return
          }
          console.log()
          table(mapItems(items), columns)
        },
        limit: Number(args.limit || 20),
        startPage: Number(args.page || 1),
      })
      return
    }

    try {
      const data = await withSpinner(
        { start: 'Fetching events...' },
        () => client.get<any>('/events', { ...params, page: args.page!, limit: args.limit! }),
      )
      const items = data.items || []
      if (items.length === 0) {
        console.log('\n  No events found.\n')
        return
      }
      console.log()
      table(mapItems(items), columns)
      console.log(`\n  Page ${data.page || args.page} of ${data.totalPages || '?'} (${data.total} total)\n`)
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
