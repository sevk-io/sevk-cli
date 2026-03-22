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
  meta: { name: 'list-contacts', description: 'List contacts in an audience' },
  args: {
    ...globalArgs,
    ...paginationArgs,
    id: { type: 'positional', description: 'Audience ID', required: true },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    if (isJsonOutput(args)) {
      const result = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<any>(`/audiences/${args.id}/contacts`, { page: args.page, limit: args.limit }),
      )
      json(result)
      return
    }

    if (isMenuMode()) {
      await interactivePaginate({
        fetch: (page, limit) => client.get<any>(`/audiences/${args.id}/contacts`, { page, limit }),
        render: (items) => table(items, columns),
        limit: Number(args.limit || 20),
        startPage: Number(args.page || 1),
      })
      return
    }

    try {
      const result = await withSpinner(
        { start: 'Fetching contacts...' },
        () => client.get<any>(`/audiences/${args.id}/contacts`, { page: args.page, limit: args.limit }),
      )
      table(Array.isArray(result.items || result) ? (result.items || result) : [], columns)
      printPaginationInfo(`sevk audiences list-contacts ${args.id}`, args, result.total)
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
