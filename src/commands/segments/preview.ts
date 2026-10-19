import { readFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import {
  parseSegmentDefinition,
  type SegmentDefinition
} from '~/lib/segment-input'
import { withSpinner } from '~/lib/spinner'

interface PreviewContact {
  id: string
  email: string
  subscribed: boolean
  createdAt: string
}

interface PreviewResponse {
  count: number
  contacts: PreviewContact[]
}

export default defineCommand({
  meta: { name: 'preview', description: 'Preview segment size with given rules' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    file: { type: 'string', description: 'JSON file with segment rules ({rules, operator, limitToTopics?, groups?})', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    let body: SegmentDefinition

    try {
      const raw = await readFile(args.file, 'utf-8')

      body = parseSegmentDefinition(
        JSON.parse(raw),
        true
      ) as SegmentDefinition
    } catch (err: unknown) {
      error(`Cannot read or parse file: ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1

      return
    }

    try {
      const result = await withSpinner(
        { start: 'Previewing segment...' },
        () => client.post<PreviewResponse>(`/audiences/${args['audience-id']}/segments/preview`, body)
      )

      if (isJsonOutput(args)) {
        json(result)
      } else {
        success(`Preview: ${result.count} contacts match`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
