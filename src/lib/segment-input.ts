import {
  assertJsonObject,
  assertOnlyKeys,
  type JsonObject
} from './json-input'

const RULE_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'lessThan',
  'greaterOrEqual',
  'lessOrEqual',
  'isEmpty',
  'isNotEmpty',
  'in',
  'notIn'
] as const

type RuleOperator = typeof RULE_OPERATORS[number]
type BooleanOperator = 'AND' | 'OR'

export interface SegmentRule {
  field: string
  operator: RuleOperator
  value: unknown
  groupId?: string
  groupOperator?: BooleanOperator
}

export interface SegmentGroup {
  id: string
  operator: BooleanOperator
}

export interface SegmentDefinition {
  rules: SegmentRule[]
  operator: BooleanOperator
  limitToTopics?: string[]
  groups?: SegmentGroup[]
}

export type SegmentUpdate = Partial<SegmentDefinition> & { name?: string }

const parseOperator = (
  value: unknown,
  description: string
): BooleanOperator => {
  if (value !== 'AND' && value !== 'OR') {
    throw new TypeError(`${description} must be AND or OR`)
  }

  return value
}

const parseRules = (value: unknown): SegmentRule[] => {
  if (!Array.isArray(value) || value.length > 200) {
    throw new TypeError('rules must be an array with at most 200 entries')
  }

  return value.map((entry, index) => {
    const rule = assertJsonObject(entry, `Rule ${index + 1}`)
    assertOnlyKeys(
      rule,
      ['field', 'operator', 'value', 'groupId', 'groupOperator'],
      `Rule ${index + 1}`
    )

    if (typeof rule.field !== 'string' || rule.field.length === 0) {
      throw new TypeError(`Rule ${index + 1} field must be a non-empty string`)
    }
    if (!(RULE_OPERATORS as readonly unknown[]).includes(rule.operator)) {
      throw new TypeError(`Rule ${index + 1} has an invalid operator`)
    }
    if (!Object.hasOwn(rule, 'value')) {
      throw new TypeError(`Rule ${index + 1} must include value`)
    }
    if (rule.groupId !== undefined && typeof rule.groupId !== 'string') {
      throw new TypeError(`Rule ${index + 1} groupId must be a string`)
    }
    if (
      rule.groupOperator !== undefined &&
      rule.groupOperator !== 'AND' &&
      rule.groupOperator !== 'OR'
    ) {
      throw new TypeError(`Rule ${index + 1} groupOperator must be AND or OR`)
    }

    return rule as unknown as SegmentRule
  })
}

const parseTopics = (value: unknown): string[] => {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some(topic => typeof topic !== 'string')
  ) {
    throw new TypeError('limitToTopics must contain at most 100 strings')
  }

  return value
}

const parseGroups = (value: unknown): SegmentGroup[] => {
  if (!Array.isArray(value) || value.length > 100) {
    throw new TypeError('groups must be an array with at most 100 entries')
  }

  return value.map((entry, index) => {
    const group = assertJsonObject(entry, `Group ${index + 1}`)
    assertOnlyKeys(group, ['id', 'operator'], `Group ${index + 1}`)

    if (typeof group.id !== 'string' || group.id.length === 0) {
      throw new TypeError(`Group ${index + 1} id must be a non-empty string`)
    }

    return {
      id: group.id,
      operator: parseOperator(group.operator, `Group ${index + 1} operator`)
    }
  })
}

const assertDeclaredRuleGroups = (
  rules: SegmentRule[],
  groups: SegmentGroup[]
): void => {
  const groupIds = new Set(groups.map(group => group.id))
  if (rules.some(rule => rule.groupId && !groupIds.has(rule.groupId))) {
    throw new TypeError('Every rule groupId must reference a declared group')
  }
}

export const parseSegmentDefinition = (
  value: unknown,
  required: boolean
): SegmentDefinition | SegmentUpdate => {
  const input = assertJsonObject(value, 'Segment definition')
  assertOnlyKeys(
    input,
    ['rules', 'operator', 'limitToTopics', 'groups'],
    'Segment definition'
  )

  const output: JsonObject = {}
  if (input.rules !== undefined) output.rules = parseRules(input.rules)
  if (input.operator !== undefined) {
    output.operator = parseOperator(input.operator, 'operator')
  }
  if (input.limitToTopics !== undefined) {
    output.limitToTopics = parseTopics(input.limitToTopics)
  }
  if (input.groups !== undefined) output.groups = parseGroups(input.groups)

  if (required && (output.rules === undefined || output.operator === undefined)) {
    throw new TypeError('Segment definition must include rules and operator')
  }

  if (required) {
    assertDeclaredRuleGroups(
      output.rules as unknown as SegmentRule[],
      (output.groups ?? []) as unknown as SegmentGroup[]
    )
  } else if (output.rules !== undefined && output.groups !== undefined) {
    assertDeclaredRuleGroups(
      output.rules as unknown as SegmentRule[],
      output.groups as unknown as SegmentGroup[]
    )
  }

  return output as SegmentDefinition | SegmentUpdate
}
