export type JsonObject = Record<string, unknown>

export const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const assertJsonObject = (
  value: unknown,
  description: string
): JsonObject => {
  if (!isJsonObject(value)) {
    throw new TypeError(`${description} must be a JSON object`)
  }

  return value
}

export const assertOnlyKeys = (
  value: JsonObject,
  keys: readonly string[],
  description: string
): void => {
  const allowed = new Set(keys)
  const unsupported = Object.keys(value).filter(key => !allowed.has(key))

  if (unsupported.length > 0) {
    throw new TypeError(`${description} contains unsupported field(s): ${unsupported.join(', ')}`)
  }
}
