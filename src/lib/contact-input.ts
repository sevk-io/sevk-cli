import {
  assertJsonObject,
  assertOnlyKeys,
  type JsonObject
} from './json-input'

export interface ContactInput {
  email: string
  subscribed?: boolean
  data?: JsonObject | null
}

export interface ImportContactInput {
  email: string
  subscribed?: boolean
  data?: JsonObject
}

const parseContact = (
  value: unknown,
  index: number,
  allowNullData: boolean
): ContactInput => {
  const contact = assertJsonObject(value, `Contact ${index + 1}`)
  assertOnlyKeys(contact, ['email', 'subscribed', 'data'], `Contact ${index + 1}`)

  if (typeof contact.email !== 'string' || contact.email.length === 0) {
    throw new TypeError(`Contact ${index + 1} must have a non-empty email`)
  }
  if (contact.subscribed !== undefined && typeof contact.subscribed !== 'boolean') {
    throw new TypeError(`Contact ${index + 1} subscribed must be a boolean`)
  }
  if (contact.data !== undefined) {
    if (contact.data === null && !allowNullData) {
      throw new TypeError(`Contact ${index + 1} data cannot be null`)
    }
    if (contact.data !== null) {
      assertJsonObject(contact.data, `Contact ${index + 1} data`)
    }
  }

  return contact as unknown as ContactInput
}

export function parseContacts(
  value: unknown,
  options: { max: number, allowNullData: true }
): ContactInput[]
export function parseContacts(
  value: unknown,
  options: { max: number, allowNullData: false }
): ImportContactInput[]
export function parseContacts(
  value: unknown,
  options: { max: number, allowNullData: boolean }
): ContactInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError('contacts must be a non-empty array')
  }
  if (value.length > options.max) {
    throw new TypeError(`contacts cannot contain more than ${options.max} entries`)
  }

  return value.map((contact, index) =>
    parseContact(contact, index, options.allowNullData)
  )
}
