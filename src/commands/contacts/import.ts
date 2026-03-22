import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'


export default defineCommand({
  meta: { name: 'import', description: 'Import contacts from a CSV file' },
  args: {
    ...globalArgs,
    file: { type: 'positional', description: 'Path to CSV file', required: true },
    'audience-id': { type: 'string', description: 'Target audience ID' },
  },
  async run({ args }) {
    let csvContent: string

    try {
      csvContent = await readFile(args.file, 'utf-8')
    } catch {
      error(`Cannot read file: ${args.file}`)
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const body: Record<string, any> = { csv: csvContent }
    if (args['audience-id']) body.audienceId = args['audience-id']

    try {
      const result = await withSpinner(
        {
          start: 'Importing contacts...',
          success: (r: any) => `${r.imported ?? r.success ?? 0} imported, ${r.failed ?? r.errors?.length ?? 0} failed`,
        },
        () => client.post<any>('/contacts/import', body),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${result.imported ?? result.success ?? 0} contacts imported`)
        if (result.errors?.length) {
          console.log()
          for (const err of result.errors.slice(0, 10)) {
            console.log(`  Row ${err.row ?? err.index}: ${err.error ?? err.message}`)
          }
          if (result.errors.length > 10) {
            console.log(`  ... and ${result.errors.length - 10} more`)
          }
        }
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
