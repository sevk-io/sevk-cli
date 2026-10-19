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

interface Segment {
  id: string
}

export default defineCommand({
  meta: { name: 'create', description: 'Create a segment from a JSON rules file' },
  args: {
    ...globalArgs,
    'audience-id': { type: 'string', description: 'Audience ID', required: true },
    name: { type: 'string', description: 'Segment name', required: true },
    file: { type: 'string', description: 'JSON file containing rules and operator (and optional limitToTopics, groups)' },
    operator: { type: 'string', description: 'Top-level operator: AND or OR (default: AND, ignored when --file is given)' }
  },
  async run({ args }) {
    let definition: SegmentDefinition

    if (args.file) {
      try {
        const raw = await readFile(args.file, 'utf-8')
        definition = parseSegmentDefinition(
          JSON.parse(raw),
          true
        ) as SegmentDefinition
      } catch (err: unknown) {
        error(`Cannot read or parse file: ${err instanceof Error ? err.message : String(err)}`)
        process.exitCode = 1

        return
      }
    } else {
      const operator = (args.operator ?? 'AND').toUpperCase()
      if (operator !== 'AND' && operator !== 'OR') {
        error('--operator must be AND or OR')
        process.exitCode = 1

        return
      }
      definition = { rules: [], operator }
    }

    const client = await createClient(getClientOpts(args))
    const payload = {
      name: args.name,
      rules: definition.rules,
      operator: definition.operator,
      ...(definition.limitToTopics
        ? { limitToTopics: definition.limitToTopics }
        : {}),
      ...(definition.groups ? { groups: definition.groups } : {})
    }

    try {
      const segment = await withSpinner(
        { start: 'Creating segment...', success: 'Segment created' },
        () => client.post<Segment>(`/audiences/${args['audience-id']}/segments`, payload)
      )

      if (isJsonOutput(args)) {
        json(segment)
      } else {
        success(`Segment created (${segment.id})`)
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1

      return
    }
  }
})
