import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface DownloadResponse {
  url: string
  filename?: string | null
  mimeType?: string | null
}

export default defineCommand({
  meta: { name: 'download', description: 'Get a short-lived download URL for an inbound attachment' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Inbound email ID', required: true },
    'attachment-id': { type: 'positional', description: 'Attachment ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const result = await withSpinner(
        { start: 'Generating download URL...' },
        () => client.get<DownloadResponse>(`/inbound/${args.id}/attachments/${args['attachment-id']}/download`)
      )

      if (isJsonOutput(args)) {
        json(result)

        return
      }

      console.log()
      keyValue([
        ['Filename', result.filename || '-'],
        ['MIME type', result.mimeType || '-'],
        ['URL', result.url]
      ])
      console.log()
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
