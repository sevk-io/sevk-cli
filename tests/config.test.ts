import { describe, expect, it } from 'bun:test'

import { maskKey, validateBaseUrl, validateKeyFormat } from '../src/lib/config'

describe('Config Utils', () => {
  it('should validate correct API key format', () => {
    expect(validateKeyFormat('sevk_abc1234567')).toBeNull()
  })

  it('should reject empty key', () => {
    expect(validateKeyFormat('')).toBe('API key is required')
  })

  it('should reject key without sevk_ prefix', () => {
    expect(validateKeyFormat('invalid_key')).toBe('API key must start with "sevk_"')
  })

  it('should reject short key', () => {
    expect(validateKeyFormat('sevk_ab')).toBe('API key is too short')
  })

  it('should mask key correctly', () => {
    const masked = maskKey('sevk_full_abcdefghij1234567890')
    expect(masked).toBe('sevk_f...7890')
  })

  it('should mask short key', () => {
    expect(maskKey('short')).toBe('***')
  })

  it('allows https anywhere and http only for loopback', () => {
    expect(validateBaseUrl('https://api.sevk.io')).toBeNull()
    expect(validateBaseUrl('http://localhost:4000')).toBeNull()
    expect(validateBaseUrl('http://127.0.0.1:4000')).toBeNull()
    expect(validateBaseUrl('http://api.sevk.io')).not.toBeNull()
  })

  it('rejects http to a .local host so the bearer key is never sent cleartext on a LAN', () => {
    expect(validateBaseUrl('http://api.local')).not.toBeNull()
    expect(validateBaseUrl('http://sevk.local')).not.toBeNull()
  })
})
