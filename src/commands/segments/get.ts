import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { error, json } from '~/lib/output'
import type { SegmentGroup, SegmentRule } from '~/lib/segment-input'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

interface Segment {
  id: string
  name: string
  operator: string
  rules: SegmentRule[]
  limitToTopics: string[]
  groups: SegmentGroup[] | null
  lastRunAt: string | null
  lastRunCount: number | null
  createdAt: string
}

export default defineCommand({
  meta: { name: 'get', description: 'Get segment details' },
  args: {
    ...globalArgs,
    id: { type: 'positional', description: 'Segment ID', required: true }
  },
  async run({ args }) {
    const client = await createClient(getClientOpts(args))

    try {
      const segment = await withSpinner(
        { start: 'Fetching segment...' },
        () => client.get<Segment>(`/segments/${args.id}`)
      )

      if (isJsonOutput(args)) {
        json(segment)
      } else {
        console.log()
        keyValue([
          ['ID', segment.id],
          ['Name', segment.name],
          ['Operator', segment.operator],
          ['Rules', String(Array.isArray(segment.rules) ? segment.rules.length : 0)],
          ['Limit to topics', Array.isArray(segment.limitToTopics) && segment.limitToTopics.length ? segment.limitToTopics.join(', ') : '-'],
          ['Last run', segment.lastRunAt ? `${new Date(segment.lastRunAt).toLocaleString()} (${segment.lastRunCount ?? 0} contacts)` : 'Never'],
          ['Created', new Date(segment.createdAt).toLocaleString()]
        ])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
