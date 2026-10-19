export const parseBool = (v: unknown): boolean | undefined => {
  if (v === undefined) {
    return undefined
  }

  const raw = String(v).toLowerCase()

  if (raw === 'true' || raw === '1') {
    return true
  }

  if (raw === 'false' || raw === '0') {
    return false
  }

  return undefined
}
