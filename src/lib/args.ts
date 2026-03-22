export const globalArgs = {
  'api-key': {
    type: 'string' as const,
    description: 'API key (overrides config and env)',
  },
  'base-url': {
    type: 'string' as const,
    description: 'API base URL (overrides profile config)',
  },
  profile: {
    type: 'string' as const,
    alias: 'p',
    description: 'Profile name to use',
  },
  json: {
    type: 'boolean' as const,
    description: 'Output as JSON',
  },
  quiet: {
    type: 'boolean' as const,
    alias: 'q',
    description: 'Suppress interactive output (implies --json)',
  },
} as const

export type GlobalArgs = {
  'api-key'?: string
  'base-url'?: string
  profile?: string
  json?: boolean
  quiet?: boolean
}

export function getClientOpts(args: GlobalArgs) {
  return {
    apiKey: args['api-key'],
    baseUrl: args['base-url'],
    profile: args.profile,
  }
}

export function isJsonOutput(args: GlobalArgs): boolean {
  return !!args.json || !!args.quiet
}
