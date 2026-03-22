import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { withSpinner } from '~/lib/spinner'
import { json, success, error } from '~/lib/output'

export default defineCommand({
  meta: { name: 'preview', description: 'Preview segment size with given rules' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    file: { type: 'string', description: 'JSON file with segment rules' },
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    let body: any = {}

    if (args.file) {
      try {
        const raw = await readFile(args.file, 'utf-8')
        body = JSON.parse(raw)
      } catch (err: any) {
        error(`Cannot read or parse file: ${err.message}`)
        process.exitCode = 1; return
      }
    }

    try {
      const result = await withSpinner(
        { start: 'Previewing segment...' },
        () => client.post<any>(`/audiences/${args['audience-id']}/segments/preview`, body),
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`Preview: ${result.count ?? result.total ?? JSON.stringify(result)} contacts match`)
      }
    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
