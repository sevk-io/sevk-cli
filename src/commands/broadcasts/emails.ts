import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error, isMenuMode } from '~/lib/output'
import { table } from '~/lib/table'
import { interactivePaginate } from '~/lib/pagination'

const columns = [
  { key: 'to', label: 'To' },
  { key: 'status', label: 'Status' },
  { key: 'opened', label: 'Opened' },
  { key: 'clicked', label: 'Clicked' },
  { key: 'sentAt', label: 'Sent At' },
]

function mapItems(items: any[]) {
  return items.map((e: any) => ({
    to: e.contact?.email || e.to,
    status: e.status,
    opened: e.openedAt ? 'Yes' : '—',
    clicked: e.clickedAt ? 'Yes' : '—',
    sentAt: e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '—',
  }))
}

export default defineCommand({
  meta: { name: 'emails', description: 'List emails sent by a broadcast' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Broadcast ID', required: true },
    page: { type: 'string', description: 'Page number', default: '1' },
    limit: { type: 'string', description: 'Items per page', default: '20' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const endpoint = `/broadcasts/${args.id}/emails`

    if (isJsonOutput(args)) {
      const data = await withSpinner(
        { start: 'Fetching emails...' },
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
            console.log('\n  No emails found.\n')
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
        { start: 'Fetching emails...' },
        () => client.get<any>(endpoint, { page: args.page, limit: args.limit }),
      )
      const items = data.items || []
      if (items.length === 0) {
        console.log('\n  No emails found.\n')
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
