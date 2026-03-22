import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'


export default defineCommand({
  meta: { name: 'bulk-update', description: 'Bulk update contacts from a JSON file' },
  args: {
    ...globalArgs,
    file: { type: 'positional', description: 'Path to JSON file with updates', required: true },
  },
  async run({ args }) {
    let updates: any

    try {
      const raw = await readFile(args.file, 'utf-8')
      updates = JSON.parse(raw)
    } catch (err: any) {
      error(`Cannot read or parse file: ${err.message}`)
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Updating contacts...', success: 'Contacts updated' },
        () => client.put<any>('/contacts/bulk-update', updates),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${result.updated ?? 'Contacts'} updated`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
