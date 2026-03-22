import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error, isMenuMode } from '~/lib/output'
import { table } from '~/lib/table'
import { paginationArgs, printPaginationInfo, interactivePaginate } from '~/lib/pagination'
import pc from 'picocolors'

const statusColor: Record<string, (s: string) => string> = {
  DRAFT: pc.dim,
  QUEUED: pc.yellow,
  SENDING: pc.blue,
  SENT: pc.green,
  CANCELLED: pc.red,
  FAILED: pc.red,
}

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Name', format: (v: string) => v || '—' },
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status', format: (v: string) => (statusColor[v] || pc.white)(v) },
  { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() },
]

export default defineCommand({
  meta: { name: 'list', description: 'List broadcasts' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    status: { type: 'string', description: 'Filter by status (DRAFT, QUEUED, SENDING, SENT, CANCELLED, FAILED)' },
    search: { type: 'string', description: 'Search by name or subject' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    if (isJsonOutput(args)) {
      const result = await withSpinner(
        { start: 'Fetching broadcasts...' },
        () => client.get<any>('/broadcasts', { page: args.page, limit: args.limit, status: args.status, search: args.search }),
      )
      json(result)
      return
    }

    if (isMenuMode()) {
      await interactivePaginate({
        fetch: (page, limit) => client.get<any>('/broadcasts', { page, limit, status: args.status, search: args.search }),
        render: (items) => table(items, columns),
        limit: Number(args.limit || 20),
        startPage: Number(args.page || 1),
      })
      return
    }

    try {
      const result = await withSpinner(
        { start: 'Fetching broadcasts...' },
        () => client.get<any>('/broadcasts', { page: args.page, limit: args.limit, status: args.status, search: args.search }),
      )
      table(Array.isArray(result.items || result) ? (result.items || result) : [], columns)
      printPaginationInfo('sevk broadcasts list', args, result.total)
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
