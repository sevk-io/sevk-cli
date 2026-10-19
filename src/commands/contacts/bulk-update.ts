import { readFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { type ContactInput, parseContacts } from '~/lib/contact-input'
import { assertJsonObject, assertOnlyKeys } from '~/lib/json-input'
import {
  error,
  json,
  success,
  warn
} from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface BulkUpdateResponse {
  updated: number
  notFound: number
  errors: string[]
  updatedEmails: string[]
  notFoundEmails: string[]
}

export default defineCommand({
  meta: { name: 'bulk-update', description: 'Bulk update contacts from a JSON file ({contacts: [{email, subscribed?, data?}]})' },
  args: {
    ...globalArgs,
    file: { type: 'positional', description: 'Path to JSON file with updates', required: true }
  },
  async run({ args }) {
    let contacts: ContactInput[]

    try {
      const raw = await readFile(args.file, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      const source = Array.isArray(parsed)
        ? parsed
        : (() => {
            const object = assertJsonObject(parsed, 'Bulk update payload')
            assertOnlyKeys(object, ['contacts'], 'Bulk update payload')

            return object.contacts
          })()

      contacts = parseContacts(source, { max: 10_000, allowNullData: true })
    } catch (err: unknown) {
      error(`Cannot read or parse file: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body = { contacts }

    try {
      const result = await withSpinner(
        { start: 'Updating contacts...', success: 'Bulk update finished' },
        () => client.put<BulkUpdateResponse>('/contacts/bulk-update', body)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${result.updated} updated, ${result.notFound} not found`)
        if (Array.isArray(result.errors) && result.errors.length > 0) {
          warn(`${result.errors.length} error(s):`)
          for (const msg of result.errors) {
            console.log(`  - ${msg}`)
          }
        }
      }
      if (result.notFound > 0 || result.errors.length > 0) {
        process.exitCode = 1
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
