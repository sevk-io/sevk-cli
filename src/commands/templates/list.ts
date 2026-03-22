import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error, isMenuMode } from '~/lib/output'
import { table } from '~/lib/table'
import { paginationArgs, printPaginationInfo, interactivePaginate } from '~/lib/pagination'

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'style', label: 'Style', format: (v: string) => v || '—' },
  { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleDateString() },
]

export default defineCommand({
  meta: { name: 'list', description: 'List templates' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    search: { type: 'string', description: 'Search by title' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    if (isJsonOutput(args)) {
      const result = await withSpinner(
        { start: 'Fetching templates...' },
        () => client.get<any>('/templates', { page: args.page, limit: args.limit, search: args.search }),
      )
      json(result)
      return
    }

    if (isMenuMode()) {
      await interactivePaginate({
        fetch: (page, limit) => client.get<any>('/templates', { page, limit, search: args.search }),
        render: (items) => table(items, columns),
        limit: Number(args.limit || 20),
        startPage: Number(args.page || 1),
      })
      return
    }

    try {
      const result = await withSpinner(
        { start: 'Fetching templates...' },
        () => client.get<any>('/templates', { page: args.page, limit: args.limit, search: args.search }),
      )
      const templates = result.items || result
      table(Array.isArray(templates) ? templates : [], columns)
      printPaginationInfo('sevk templates list', args, result.total)
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
