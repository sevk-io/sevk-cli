import { readFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import {
  type ImportContactInput,
  parseContacts
} from '~/lib/contact-input'
import { parseCsv } from '~/lib/csv-input'
import { error, json, success } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'

interface ImportedContact {
  id: string
  email: string
  subscribed: boolean
}

interface ImportResponse {
  created: number
  errors: string[]
  contacts: ImportedContact[]
}

const parseSubscribed = (val: string | undefined): boolean | undefined => {
  if (val === undefined || val === '') {
    return undefined
  }

  const lower = val.toLowerCase()

  if (lower === 'true' || lower === '1' || lower === 'yes') {
    return true
  }

  if (lower === 'false' || lower === '0' || lower === 'no') {
    return false
  }

  throw new Error(`Invalid "subscribed" value: "${val}". Use true/false, 1/0, or yes/no.`)
}

export default defineCommand({
  meta: { name: 'bulk-import', description: 'Bulk import contacts from a CSV or JSON file' },
  args: {
    ...globalArgs,
    file: { type: 'positional', description: 'Path to CSV or JSON file; JSON accepts an array or {contacts:[...]}', required: true },
    'audience-id': { type: 'string', description: 'Target audience ID' },
    'topic-id': { type: 'string', description: 'Target topic ID (also attaches to the topic\'s parent audience)' }
  },
  async run({ args }) {
    let csvContent: string

    try {
      csvContent = await readFile(args.file, 'utf-8')
    } catch {
      error(`Cannot read file: ${args.file}`)
      process.exitCode = 1

      return
    }

    const trimmed = csvContent.trim()
    let rawJsonContacts: unknown[] | undefined

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        const candidate = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object' ? (parsed as { contacts?: unknown }).contacts : undefined

        if (!Array.isArray(candidate)) {
          throw new Error()
        }

        rawJsonContacts = candidate
      } catch {
        error('JSON import must be an array or an object with a contacts array.')
        process.exitCode = 1

        return
      }
    }

    let rows: Array<Record<string, string>>

    try {
      rows = rawJsonContacts ? [] : parseCsv(csvContent)
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }

    if (rawJsonContacts && rawJsonContacts.length === 0) {
      error('JSON contacts array is empty.')
      process.exitCode = 1

      return
    }

    if (!rawJsonContacts && rows.length === 0) {
      error('CSV file is empty or malformed.')
      process.exitCode = 1

      return
    }

    if (!rawJsonContacts && !('email' in rows[0])) {
      error('CSV must include an "email" column.')
      process.exitCode = 1

      return
    }

    let contacts: ImportContactInput[]

    try {
      const source = rawJsonContacts ?? rows
        .filter(row => row.email)
        .map(row => {
          const { email, subscribed, ...rest } = row
          const data: Record<string, string> = {}

          for (const [k, v] of Object.entries(rest)) {
            if (v !== undefined && v !== '') {
              data[k] = v
            }
          }

          const subscribedFlag = parseSubscribed(subscribed)

          return {
            email,
            ...(subscribedFlag !== undefined ? { subscribed: subscribedFlag } : {}),
            ...(Object.keys(data).length > 0 ? { data } : {})
          }
        })

      contacts = parseContacts(source, { max: 50_000, allowNullData: false })
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1

      return
    }

    if (contacts.length === 0) {
      error('No contacts with a non-empty email column were found.')
      process.exitCode = 1

      return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, unknown> = { contacts }

    if (args['audience-id']) {
      body.audienceId = args['audience-id']
    }

    if (args['topic-id']) {
      body.topicId = args['topic-id']
    }

    try {
      const result = await withSpinner(
        {
          start: `Importing ${contacts.length} contacts...`,
          success: (r: ImportResponse) => `${r.created ?? 0} created, ${r.errors?.length ?? 0} skipped`
        },
        () => client.post<ImportResponse>('/contacts/import', body)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${result.created ?? 0} contacts imported`)
        if (result.errors?.length) {
          console.log()
          for (const err of result.errors.slice(0, 10)) {
            console.log(`  ${err}`)
          }

          if (result.errors.length > 10) {
            console.log(`  ... and ${result.errors.length - 10} more`)
          }
        }
      }
      if (result.errors.length > 0) {
        process.exitCode = 1
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
