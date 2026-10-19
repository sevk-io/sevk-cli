export interface VariantFlag {
  label: string
  subject?: string
  body?: string
  fromName?: string
}

export const parseVariantFlag = (raw: string): VariantFlag => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid --variant value: ${raw}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid --variant value: ${raw}`)
  }
  const value = parsed as Record<string, unknown>
  const keys = Object.keys(value)
  if (
    typeof value.label !== 'string' ||
    !value.label.trim() ||
    keys.some(key => !['label', 'subject', 'body', 'fromName'].includes(key)) ||
    ['subject', 'body', 'fromName'].some(
      key => value[key] !== undefined && typeof value[key] !== 'string'
    ) ||
    !['subject', 'body', 'fromName'].some(key => typeof value[key] === 'string')
  ) {
    throw new Error(`Invalid --variant value: ${raw}`)
  }

  return value as unknown as VariantFlag
}

export const parseVariantsJson = (
  raw: string,
  allowNull = false
): VariantFlag[] | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid --variants-json')
  }
  if (parsed === null && allowNull) return null
  if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 4) {
    throw new Error('Invalid --variants-json')
  }

  return parsed.map(value => parseVariantFlag(JSON.stringify(value)))
}
