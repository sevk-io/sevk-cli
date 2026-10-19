import { readFile } from 'node:fs/promises'

import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json, success } from '~/lib/output'
import {
  parseSegmentDefinition,
  type SegmentUpdate
} from '~/lib/segment-input'
import { withSpinner } from '~/lib/spinner'

export default defineCommand({
  meta: { name: 'update', description: 'Update a segment' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Segment ID', required: true },
    name: { type: 'string', description: 'Segment name' },
    file: { type: 'string', description: 'JSON file containing any of: rules, operator, limitToTopics, groups' }
  },
  async run({ args }) {
    let body: SegmentUpdate = {}

    if (args.name !== undefined) {
      body.name = args.name
    }

    if (args.file !== undefined) {
      try {
        const raw = await readFile(args.file, 'utf-8')
        body = {
          ...body,
          ...parseSegmentDefinition(JSON.parse(raw), false)
        }
      } catch (err: unknown) {
        error(`Cannot read or parse file: ${err instanceof Error ? err.message : String(err)}`)
        process.exitCode = 1

        return
      }
    }

    const client = await createClient(getClientOpts(args))

    try {
      const segment = await withSpinner(
        { start: 'Updating segment...', success: 'Segment updated' },
        () => client.put(`/segments/${args.id}`, body)
      )

      if (isJsonOutput(args)) {
        json(segment)
      } else {
        success('Segment updated')
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
