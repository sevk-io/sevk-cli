import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error, isMenuMode } from '~/lib/output'
import { table } from '~/lib/table'
import { paginationArgs, printPaginationInfo, interactivePaginate } from '~/lib/pagination'

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Type' },
  { key: 'action', label: 'Action' },
  { key: 'description', label: 'Description', format: (v: string) => v || '—' },
  { key: 'createdAt', label: 'Date', format: (v: string) => new Date(v).toLocaleString() },
]

export default defineCommand({
  meta: { name: 'events', description: 'List events for a contact' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    id: { type: 'positional', description: 'Contact ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    if (isJsonOutput(args)) {
      const result = await withSpinner(
        { start: 'Fetching events...' },
        () => client.get<any>(`/contacts/${args.id}/events`, { page: args.page, limit: args.limit }),
      )
      json(result)
      return
    }

    if (isMenuMode()) {
      await interactivePaginate({
        fetch: (page, limit) => client.get<any>(`/contacts/${args.id}/events`, { page, limit }),
        render: (items) => table(items, columns),
        limit: Number(args.limit || 20),
        startPage: Number(args.page || 1),
      })
      return
    }

    try {
      const result = await withSpinner(
        { start: 'Fetching events...' },
        () => client.get<any>(`/contacts/${args.id}/events`, { page: args.page, limit: args.limit }),
      )
      table(Array.isArray(result.items || result) ? (result.items || result) : [], columns)
      printPaginationInfo(`sevk contacts events ${args.id}`, args, result.total)
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
