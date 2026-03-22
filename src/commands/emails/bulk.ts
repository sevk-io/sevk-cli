import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'


export default defineCommand({
  meta: { name: 'bulk', description: 'Send bulk emails from a JSON file' },
  args: {
    ...globalArgs,
    file: { type: 'positional', description: 'Path to JSON file with emails array', required: true },
  },
  async run({ args }) {
    let emails: any[]

    try {
      const raw = await readFile(args.file, 'utf-8')
      const parsed = JSON.parse(raw)
      emails = Array.isArray(parsed) ? parsed : parsed.emails
      if (!Array.isArray(emails)) {
        error('JSON must be an array of emails or { emails: [...] }')
        process.exitCode = 1; return
      }
    } catch (err: any) {
      error(`Cannot read or parse file: ${err.message}`)
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        {
          start: `Sending ${emails.length} emails...`,
          success: (r: any) => `${r.success} sent, ${r.failed} failed`,
        },
        () => client.post<any>('/emails/bulk', { emails }),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`${result.success} sent, ${result.failed} failed`)
        if (result.errors?.length) {
          for (const err of result.errors) {
            console.log(`  ${err.email}: ${err.error}`)
          }
        }
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
