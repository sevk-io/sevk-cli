import type { ArgDef, CommandDef } from 'citty'

const GLOBAL_STRING_OPTIONS = new Map([
  ['--api-key', '--api-key'],
  ['--base-url', '--base-url'],
  ['--profile', '--profile'],
  ['-p', '--profile']
])
const GLOBAL_BOOLEAN_OPTIONS = new Set(['--json', '--quiet', '-q'])

export const normalizeGlobalArgs = (rawArgs: string[]): string[] => {
  const commandArgs: string[] = []
  const globalArgs: string[] = []

  for (let index = 0; index < rawArgs.length; index += 1) {
    const token = rawArgs[index]
    const [name] = token.split('=', 1)
    const normalizedName = GLOBAL_STRING_OPTIONS.get(name)

    if (normalizedName) {
      if (token.includes('=')) {
        globalArgs.push(`${normalizedName}=${token.slice(token.indexOf('=') + 1)}`)
      } else {
        const value = rawArgs[index + 1]
        if (value === undefined || value.startsWith('-')) {
          throw new TypeError(`${name} requires a value`)
        }
        globalArgs.push(`${normalizedName}=${value}`)
        index += 1
      }
    } else if (GLOBAL_BOOLEAN_OPTIONS.has(token)) {
      globalArgs.push(token)
    } else {
      commandArgs.push(token)
    }
  }

  return [...commandArgs, ...globalArgs]
}

const staticObject = <T extends object>(value: unknown, label: string): T | undefined => {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || 'then' in value) {
    throw new TypeError(`CLI ${label} must be statically defined`)
  }

  return value as T
}

const assertLeafOptions = (
  command: CommandDef,
  rawArgs: string[]
): void => {
  const definitions = staticObject<Record<string, ArgDef>>(command.args, 'arguments') ?? {}
  const longOptions = new Map<string, ArgDef>(Object.entries(definitions))
  const aliases = new Map<string, ArgDef>()

  for (const definition of Object.values(definitions)) {
    const alias = 'alias' in definition ? definition.alias : undefined
    const names = Array.isArray(alias)
      ? alias
      : alias
        ? [alias]
        : []
    for (const alias of names) aliases.set(alias, definition)
  }

  for (const token of rawArgs) {
    if (token === '--') break
    if (token === '--help' || token === '-h' || token === '--version') continue
    if (token.startsWith('--')) {
      const rawName = token.slice(2).split('=', 1)[0]
      const negated = rawName.startsWith('no-')
      const name = negated ? rawName.slice(3) : rawName
      const definition = longOptions.get(name)
      if (!definition || (negated && definition.type !== 'boolean')) {
        throw new TypeError(`Unknown option: --${rawName}`)
      }
    } else if (token.startsWith('-') && token.length > 1) {
      for (const alias of token.slice(1)) {
        if (!aliases.has(alias)) throw new TypeError(`Unknown option: -${alias}`)
      }
    }
  }
}

export const assertKnownOptions = (
  command: CommandDef,
  rawArgs: string[]
): void => {
  let current = command
  let remaining = rawArgs

  while (current.subCommands) {
    const subCommands = staticObject<Record<string, CommandDef>>(
      current.subCommands,
      'subcommands'
    ) ?? {}
    if (Object.keys(subCommands).length === 0) break
    const subCommandIndex = remaining.findIndex(token => !token.startsWith('-'))
    if (subCommandIndex < 0) return
    const next = subCommands[remaining[subCommandIndex]]
    if (!next) return
    current = next
    remaining = remaining.slice(subCommandIndex + 1)
  }

  assertLeafOptions(current, remaining)
}
