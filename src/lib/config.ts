import {
  access,
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile
} from 'node:fs/promises'
import { join } from 'node:path'

interface Profile {
  api_key: string
  base_url?: string
}

interface Config {
  active_profile: string
  profiles: Record<string, Profile>
}

const isWindows = process.platform === 'win32'

const getConfigDir = (): string => {
  const base = process.env.XDG_CONFIG_HOME
    || process.env.APPDATA
    || join(process.env.HOME || process.env.USERPROFILE || '~', '.config')

  return join(base, 'sevk')
}

export const getConfigPath = (): string => {
  return join(getConfigDir(), 'credentials.json')
}

const ensureConfigDir = async (): Promise<void> => {
  const dir = getConfigDir()

  await mkdir(dir, { recursive: true })
  if (!isWindows) {
    try {
      await chmod(dir, 0o700)
    } catch { /* ignore */ }
  }
}

const readConfig = async (): Promise<Config> => {
  const path = getConfigPath()

  try {
    await access(path)
  } catch {
    return { active_profile: 'default', profiles: {} }
  }

  const raw = await readFile(path, 'utf-8')

  try {
    return JSON.parse(raw) as Config
  } catch {
    throw new Error(`Config file is corrupt: ${path}. Fix it or run \`sevk logout --all\` to reset.`)
  }
}

const writeConfig = async (config: Config): Promise<void> => {
  await ensureConfigDir()
  const path = getConfigPath()
  const tmp = `${path}.${process.pid}.tmp`

  await writeFile(tmp, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 })
  await rename(tmp, path)
}

export const resolveApiKey = async (opts: { apiKey?: string, baseUrl?: string, profile?: string }): Promise<{
  key: string
  source: string
  baseUrl?: string
} | null> => {
  if (opts.apiKey !== undefined) {
    const formatError = validateKeyFormat(opts.apiKey)
    if (formatError) throw new Error(`Invalid --api-key: ${formatError}`)
    return { key: opts.apiKey, source: 'flag', baseUrl: opts.baseUrl || process.env.SEVK_BASE_URL }
  }

  const envKey = process.env.SEVK_API_KEY

  if (envKey) {
    return { key: envKey, source: 'env', baseUrl: opts.baseUrl || process.env.SEVK_BASE_URL }
  }

  const config = await readConfig()
  const profileName = opts.profile || process.env.SEVK_PROFILE || config.active_profile
  const profile = config.profiles[profileName]

  if (profile) {
    return {
      key: profile.api_key,
      source: `profile:${profileName}`,
      baseUrl: opts.baseUrl || profile.base_url
    }
  }

  return null
}

export const validateBaseUrl = (url: string): string | null => {
  let parsed: URL

  if (url !== url.trim()) {
    return 'Base URL must not include leading or trailing whitespace'
  }

  try {
    parsed = new URL(url)
  } catch {
    return 'Invalid URL'
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Base URL must use http:// or https://'
  }

  if (
    parsed.protocol === 'http:' &&
    parsed.hostname !== 'localhost' &&
    parsed.hostname !== '127.0.0.1' &&
    parsed.hostname !== '[::1]'
  ) {
    return 'Base URL must use HTTPS unless it targets localhost'
  }

  if (url.includes('?') || url.includes('#')) {
    return 'Base URL must not include a query string or fragment'
  }

  if (parsed.username || parsed.password) {
    return 'Base URL must not include credentials'
  }

  return null
}

export const validateKeyFormat = (key: string): string | null => {
  if (!key) {
    return 'API key is required'
  }

  if (!key.startsWith('sevk_')) {
    return 'API key must start with "sevk_"'
  }

  if (key.length < 10) {
    return 'API key is too short'
  }

  return null
}

export const storeApiKey = async (apiKey: string, profileName?: string, baseUrl?: string): Promise<void> => {
  const config = await readConfig()
  const name = profileName || 'default'

  config.profiles[name] = { api_key: apiKey, base_url: baseUrl ?? config.profiles[name]?.base_url }

  if (Object.keys(config.profiles).length === 1 || name === 'default') {
    config.active_profile = name
  }

  await writeConfig(config)
}

export const removeProfile = async (name: string): Promise<boolean> => {
  const config = await readConfig()

  if (!config.profiles[name]) {
    return false
  }

  delete config.profiles[name]

  if (config.active_profile === name) {
    const remaining = Object.keys(config.profiles)

    config.active_profile = remaining[0] || 'default'
  }

  await writeConfig(config)

  return true
}

export const removeAllProfiles = async (): Promise<void> => {
  await writeConfig({ active_profile: 'default', profiles: {} })
}

export const setActiveProfile = async (name: string): Promise<boolean> => {
  const config = await readConfig()

  if (!config.profiles[name]) {
    return false
  }

  config.active_profile = name
  await writeConfig(config)

  return true
}

export const listProfiles = async (): Promise<{ name: string, active: boolean, baseUrl?: string }[]> => {
  const config = await readConfig()

  return Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    active: name === config.active_profile,
    baseUrl: profile.base_url
  }))
}

export const updateProfileBaseUrl = async (profileName: string, baseUrl: string | null): Promise<boolean> => {
  const config = await readConfig()
  const name = profileName || config.active_profile

  if (!config.profiles[name]) {
    return false
  }

  if (baseUrl === null) {
    delete config.profiles[name].base_url
  } else {
    config.profiles[name].base_url = baseUrl
  }

  await writeConfig(config)

  return true
}

export const getProfileBaseUrl = async (profileName?: string): Promise<string | undefined> => {
  const config = await readConfig()
  const name = profileName || config.active_profile

  return config.profiles[name]?.base_url
}

export const renameProfile = async (oldName: string, newName: string): Promise<boolean> => {
  const config = await readConfig()

  if (!config.profiles[oldName]) {
    return false
  }

  if (config.profiles[newName]) {
    return false
  }

  config.profiles[newName] = config.profiles[oldName]
  delete config.profiles[oldName]

  if (config.active_profile === oldName) {
    config.active_profile = newName
  }

  await writeConfig(config)

  return true
}

export const maskKey = (key: string): string => {
  if (key.length <= 10) {
    return '***'
  }

  return `${key.slice(0, 6)}...${key.slice(-4)}`
}
