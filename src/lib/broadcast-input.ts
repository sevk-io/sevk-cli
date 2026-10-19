import { assertJsonObject, assertOnlyKeys } from './json-input'

const WINNER_METRICS = ['OPEN_RATE', 'CLICK_RATE'] as const

export interface AbTestConfig {
  testPercent: number
  evalAfterMinutes: number
  winnerMetric?: typeof WINNER_METRICS[number]
}

export const parseAbTestConfig = (value: unknown): AbTestConfig | null => {
  if (value === null) return null

  const config = assertJsonObject(value, 'A/B test config')
  assertOnlyKeys(
    config,
    ['testPercent', 'evalAfterMinutes', 'winnerMetric'],
    'A/B test config'
  )
  if (
    typeof config.testPercent !== 'number' ||
    !Number.isInteger(config.testPercent) ||
    config.testPercent < 5 ||
    config.testPercent > 50
  ) {
    throw new TypeError('A/B test testPercent must be an integer from 5 to 50')
  }
  if (
    typeof config.evalAfterMinutes !== 'number' ||
    !Number.isInteger(config.evalAfterMinutes) ||
    config.evalAfterMinutes < 5 ||
    config.evalAfterMinutes > 4320
  ) {
    throw new TypeError('A/B test evalAfterMinutes must be an integer from 5 to 4320')
  }
  if (
    config.winnerMetric !== undefined &&
    !(WINNER_METRICS as readonly unknown[]).includes(config.winnerMetric)
  ) {
    throw new TypeError('A/B test winnerMetric is invalid')
  }

  return config as unknown as AbTestConfig
}

export const assertCreateBroadcastRelationships = (
  data: Record<string, unknown>
): void => {
  const targetType = data.targetType ?? 'AUDIENCE'

  if (targetType === 'AUDIENCE' && !data.audienceId) {
    throw new TypeError('AUDIENCE target requires --audience-id')
  }
  if (targetType === 'TOPIC' && !data.topicId) {
    throw new TypeError('TOPIC target requires --topic-id')
  }
  if (targetType === 'SEGMENT' && !data.segmentId) {
    throw new TypeError('SEGMENT target requires --segment-id')
  }
  if (Boolean(data.variants) !== Boolean(data.abTest)) {
    throw new TypeError('variants and abTest must be provided together')
  }

  if (Array.isArray(data.variants)) {
    const labels = data.variants.map((variant) => (
      variant as { label?: unknown }
    ).label)

    if (new Set(labels).size !== labels.length) {
      throw new TypeError('Variant labels must be unique')
    }
  }

  if (data.replyToInbound && data.replyTo) {
    throw new TypeError('--reply-to and --reply-to-inbound cannot both be set')
  }
}

export const assertEstimateBroadcastRelationships = (
  data: Record<string, unknown>
): void => {
  if (data.targetType === 'AUDIENCE' && !data.audienceId) {
    throw new TypeError('AUDIENCE target requires --audience-id')
  }
  if (data.targetType === 'TOPIC' && !data.topicId) {
    throw new TypeError('TOPIC target requires --topic-id')
  }
  if (data.targetType === 'SEGMENT' && !data.segmentId) {
    throw new TypeError('SEGMENT target requires --segment-id')
  }
}

export const assertUpdateBroadcastRelationships = (
  data: Record<string, unknown>
): void => {
  const changesTargetId =
    data.audienceId !== undefined ||
    data.topicId !== undefined ||
    data.segmentId !== undefined

  if (changesTargetId && data.targetType === undefined) {
    throw new TypeError('--target-type is required when changing a target id')
  }
  if (data.targetType === 'AUDIENCE' && !data.audienceId) {
    throw new TypeError('AUDIENCE target requires --audience-id')
  }
  if (data.targetType === 'TOPIC' && !data.topicId) {
    throw new TypeError('TOPIC target requires --topic-id')
  }
  if (data.targetType === 'SEGMENT' && !data.segmentId) {
    throw new TypeError('SEGMENT target requires --segment-id')
  }
  if (data.variants === null && data.abTest !== undefined && data.abTest !== null) {
    throw new TypeError(
      'variants: null clears the A/B test and cannot be combined with an A/B configuration'
    )
  }
  if (data.replyToInbound && data.replyTo) {
    throw new TypeError('--reply-to and --reply-to-inbound cannot both be set')
  }
}
