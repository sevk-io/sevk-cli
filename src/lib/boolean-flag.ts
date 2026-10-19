export function parseBooleanFlag(value: string | boolean, flag: string): boolean
export function parseBooleanFlag(value: null | undefined, flag: string): undefined
export function parseBooleanFlag(value: unknown, flag: string): boolean | undefined
export function parseBooleanFlag(
  value: unknown,
  flag: string
): boolean | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value

  const normalized = String(value).trim().toLowerCase()
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true
  if (['false', '0', 'off', 'no'].includes(normalized)) return false

  throw new Error(`Invalid ${flag} value "${String(value)}". Expected true or false.`)
}

export const parseNullableBooleanFlag = (
  value: unknown,
  flag: string
): boolean | null | undefined => {
  if (value === undefined || value === null) return undefined

  const normalized = String(value).trim().toLowerCase()
  if (['default', 'null', 'inherit', ''].includes(normalized)) return null

  return parseBooleanFlag(value, flag)
}
