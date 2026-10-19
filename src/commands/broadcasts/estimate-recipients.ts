import { defineCommand } from 'citty'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { assertEstimateBroadcastRelationships } from '~/lib/broadcast-input'
import { createClient } from '~/lib/client'
import { parseEnumFlag } from '~/lib/enum-flag'
import { error, json } from '~/lib/output'
import { withSpinner } from '~/lib/spinner'
import { keyValue } from '~/lib/table'

const TARGET_TYPES = ['ALL', 'AUDIENCE', 'SEGMENT', 'TOPIC'] as const

interface RecipientEstimate {
  count: number
}

export default defineCommand({
  meta: { name: 'estimate-recipients', description: 'Estimate recipients for a broadcast target' },
  args: {
    ...globalArgs,
    'target-type': { type: 'string', description: 'Target type: ALL, AUDIENCE, TOPIC, or SEGMENT', required: true },
    'audience-id': { type: 'string', description: 'Target audience ID (for AUDIENCE)' },
    'topic-id': { type: 'string', description: 'Target topic ID (for TOPIC)' },
    'segment-id': { type: 'string', description: 'Target segment ID (for SEGMENT)' }
  },
  async run({ args }) {
    try {
      const targetType = parseEnumFlag(
        args['target-type'],
        '--target-type',
        TARGET_TYPES,
        { uppercase: true }
      )
      const body = {
        targetType,
        ...(args['audience-id'] !== undefined ? { audienceId: args['audience-id'] } : {}),
        ...(args['topic-id'] !== undefined ? { topicId: args['topic-id'] } : {}),
        ...(args['segment-id'] !== undefined ? { segmentId: args['segment-id'] } : {})
      }

      assertEstimateBroadcastRelationships(body)
      const client = await createClient(getClientOpts(args))
      const result = await withSpinner(
        { start: 'Estimating recipients...' },
        () => client.post<RecipientEstimate>('/broadcasts/estimate-recipients', body)
      )

      if (isJsonOutput(args)) json(result)
      else {
        console.log()
        keyValue([['Recipients', String(result.count)]])
        console.log()
      }
    } catch (err: unknown) {
      error(err)
      process.exitCode = 1
    }
  }
})
