import { defineCommand } from 'citty'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, error, isMenuMode } from '~/lib/output'
import { table } from '~/lib/table'
import { paginationArgs, printPaginationInfo, interactivePaginate } from '~/lib/pagination'

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'email', label: 'Email' },
  { key: 'firstName', label: 'First Name', format: (v: string) => v || '—' },
  { key: 'lastName', label: 'Last Name', format: (v: string) => v || '—' },
  { key: 'subscribed', label: 'Subscribed', format: (v: boolean) => v ? 'Yes' : 'No' },
]

export default defineCommand({
  meta: { name: 'list', description: 'List contacts' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    search: { type: 'string', description: 'Search by email' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    if (isJsonOutput(args)) {
      const result = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<any>('/contacts', { page: args.page, limit: args.limit, search: args.search }),
      )
      json(result)
      return
    }

    if (isMenuMode()) {
      await interactivePaginate({
        fetch: (page, limit) => client.get<any>('/contacts', { page, limit, search: args.search }),
        render: (items) => table(items, columns),
        limit: Number(args.limit || 20),
        startPage: Number(args.page || 1),
      })
      return
    }

    try {
      const result = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<any>('/contacts', { page: args.page, limit: args.limit, search: args.search }),
      )
      table(Array.isArray(result.items || result) ? (result.items || result) : [], columns)
      printPaginationInfo('sevk contacts list', args, result.total)
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
