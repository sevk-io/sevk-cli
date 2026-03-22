import { join } from 'node:path'
import { readFile, writeFile, mkdir, chmod, access } from 'node:fs/promises'

interface Profile {
  api_key: string
  base_url?: string
}

interface Config {
  active_profile: string
  profiles: Record<string, Profile>
}

const isWindows = process.platform === 'win32'

function getConfigDir(): string {
  const base = process.env.XDG_CONFIG_HOME
    || process.env.APPDATA
    || join(process.env.HOME || process.env.USERPROFILE || '~', '.config')
  return join(base, 'sevk')
}

export function getConfigPath(): string {
  return join(getConfigDir(), 'credentials.json')
}

async function ensureConfigDir(): Promise<void> {
  const dir = getConfigDir()
  await mkdir(dir, { recursive: true })
  if (!isWindows) {
    try { await chmod(dir, 0o700) } catch {}
  }
}

async function readConfig(): Promise<Config> {
  const path = getConfigPath()
  try {
    await access(path)
  } catch {
    return { active_profile: 'default', profiles: {} }
  }

  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as Config
  } catch {
    return { active_profile: 'default', profiles: {} }
  }
}

async function writeConfig(config: Config): Promise<void> {
  await ensureConfigDir()
  const path = getConfigPath()
  await writeFile(path, JSON.stringify(config, null, 2), 'utf-8')
  if (!isWindows) {
    try { await chmod(path, 0o600) } catch {}
  }
}

export async function resolveApiKey(opts: { apiKey?: string; baseUrl?: string; profile?: string }): Promise<{
  key: string
  source: string
  baseUrl?: string
} | null> {
  if (opts.apiKey) {
    return { key: opts.apiKey, source: 'flag', baseUrl: opts.baseUrl }
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
      baseUrl: opts.baseUrl || profile.base_url,
    }
  }

  return null
}

export function validateKeyFormat(key: string): string | null {
  if (!key) return 'API key is required'
  if (!key.startsWith('sevk_')) return 'API key must start with "sevk_"'
  if (key.length < 10) return 'API key is too short'
  return null
}

export async function storeApiKey(apiKey: string, profileName?: string, baseUrl?: string): Promise<void> {
  const config = await readConfig()
  const name = profileName || 'default'

  config.profiles[name] = { api_key: apiKey, base_url: baseUrl }

  if (Object.keys(config.profiles).length === 1 || name === 'default') {
    config.active_profile = name
  }

  await writeConfig(config)
}

export async function removeProfile(name: string): Promise<boolean> {
  const config = await readConfig()
  if (!config.profiles[name]) return false

  delete config.profiles[name]

  if (config.active_profile === name) {
    const remaining = Object.keys(config.profiles)
    config.active_profile = remaining[0] || 'default'
  }

  await writeConfig(config)
  return true
}

export async function removeAllProfiles(): Promise<void> {
  await writeConfig({ active_profile: 'default', profiles: {} })
}

export async function setActiveProfile(name: string): Promise<boolean> {
  const config = await readConfig()
  if (!config.profiles[name]) return false
  config.active_profile = name
  await writeConfig(config)
  return true
}

export async function listProfiles(): Promise<{ name: string; active: boolean; baseUrl?: string }[]> {
  const config = await readConfig()
  return Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    active: name === config.active_profile,
    baseUrl: profile.base_url,
  }))
}

export async function updateProfileBaseUrl(profileName: string, baseUrl: string | null): Promise<boolean> {
  const config = await readConfig()
  const name = profileName || config.active_profile
  if (!config.profiles[name]) return false

  if (baseUrl === null) {
    delete config.profiles[name].base_url
  } else {
    config.profiles[name].base_url = baseUrl
  }

  await writeConfig(config)
  return true
}

export async function getProfileBaseUrl(profileName?: string): Promise<string | undefined> {
  const config = await readConfig()
  const name = profileName || config.active_profile
  return config.profiles[name]?.base_url
}

export async function renameProfile(oldName: string, newName: string): Promise<boolean> {
  const config = await readConfig()
  if (!config.profiles[oldName]) return false
  if (config.profiles[newName]) return false

  config.profiles[newName] = config.profiles[oldName]
  delete config.profiles[oldName]

  if (config.active_profile === oldName) {
    config.active_profile = newName
  }

  await writeConfig(config)
  return true
}

export function maskKey(key: string): string {
  if (key.length <= 10) return '***'
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}
