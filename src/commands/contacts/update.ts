import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { assertJsonObject, type JsonObject } from '~/lib/json-input'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

export default defineCommand({
  meta: { name: 'update', description: 'Update a contact' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Contact ID', required: true },
    email: { type: 'string', description: 'New email' },
    'first-name': { type: 'string', description: 'First name' },
    'last-name': { type: 'string', description: 'Last name' },
    'data-json': { type: 'string', description: 'Exact metadata object or null as JSON' },
    subscribed: { type: 'boolean', description: 'Subscription status' }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))
    const body: Record<string, unknown> = {}

    if (args.email !== undefined) {
      body.email = args.email
    }

    if (args.subscribed !== undefined) {
      body.subscribed = args.subscribed
    }

    if (args['data-json'] !== undefined) {
      try {
        const parsed: unknown = JSON.parse(String(args['data-json']))
        const data: JsonObject | null = parsed === null
          ? null
          : assertJsonObject(parsed, '--data-json')

        body.data = data
      } catch {
        error('Invalid --data-json. Use a JSON object or null.')
        process.exitCode = 1

        return
      }
    } else {
      const data: Record<string, unknown> = {}

      if (args['first-name'] !== undefined) {
        data.firstName = String(args['first-name'])
      }

      if (args['last-name'] !== undefined) {
        data.lastName = String(args['last-name'])
      }

      if (Object.keys(data).length > 0) {
        body.data = data
      }
    }

    try {
      const contact = await withSpinner(
        { start: 'Updating contact...', success: 'Contact updated' },
        () => client.put(`/contacts/${args.id}`, body)
      )

      if (isJsonOutput(args)) {
        json(contact)
      } else {
        success('Contact updated')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
