export const parseIntegerFlag = (
  value: unknown,
  flag: string,
  fallback: number,
  minimum: number,
  maximum: number
): number => {
  if (value === undefined || value === null) return fallback

  const normalized = String(value).trim()
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`Invalid ${flag} value "${String(value)}". Expected an integer from ${minimum} to ${maximum}.`)
  }
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid ${flag} value "${String(value)}". Expected an integer from ${minimum} to ${maximum}.`)
  }

  return parsed
}
