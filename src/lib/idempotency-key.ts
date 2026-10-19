const PRINTABLE_ASCII = /^[\x20-\x7e]+$/

export const validateIdempotencyKey = (value: unknown): string | undefined => {
  if (value === undefined) return undefined
  const key = String(value)
  if (key.length < 1 || key.length > 255) {
    throw new Error('Idempotency key must be between 1 and 255 characters')
  }
  if (!PRINTABLE_ASCII.test(key)) {
    throw new Error('Idempotency key must contain printable ASCII characters only')
  }
  return key
}
