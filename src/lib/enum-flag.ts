interface EnumFlagOptions<T extends readonly string[]> {
  defaultValue?: T[number]
  uppercase?: boolean
  aliases?: Readonly<Record<string, T[number]>>
}

export function parseEnumFlag<const T extends readonly string[]>(
  value: string,
  flag: string,
  values: T,
  options?: EnumFlagOptions<T>
): T[number]
export function parseEnumFlag<const T extends readonly string[]>(
  value: string | undefined,
  flag: string,
  values: T,
  options: EnumFlagOptions<T> & { defaultValue: T[number] }
): T[number]
export function parseEnumFlag<const T extends readonly string[]>(
  value: string | undefined,
  flag: string,
  values: T,
  options?: EnumFlagOptions<T>
): T[number] | undefined
export function parseEnumFlag<const T extends readonly string[]>(
  value: string | undefined,
  flag: string,
  values: T,
  options: EnumFlagOptions<T> = {}
): T[number] | undefined {
  if (value === undefined) {
    return options.defaultValue
  }

  const normalized = options.uppercase ? value.toUpperCase() : value
  const candidate = options.aliases?.[normalized] ?? normalized

  if ((values as readonly string[]).includes(candidate)) {
    return candidate as T[number]
  }

  throw new Error(`${flag} must be one of: ${values.join(', ')}`)
}
