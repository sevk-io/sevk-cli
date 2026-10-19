import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Audience {
  id: string
  name: string
  contactsCount?: number
  createdAt: string
}

export default defineCommand({
  meta: { name: 'get', description: 'Get audience details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Audience ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const audience = await withSpinner(
        { start: 'Fetching audience...' },
        () => client.get<Audience>(`/audiences/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(audience)
      } else {
        console.log()
        keyValue([
          ['ID', audience.id],
          ['Name', audience.name],
          ['Contacts', String(audience.contactsCount ?? '-')],
          ['Created', new Date(audience.createdAt).toLocaleString()]
        ])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
