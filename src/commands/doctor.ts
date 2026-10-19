import { access, stat } from 'node:fs/promises'

import { defineCommand } from 'citty'
import pc from 'picocolors'

import { getClientOpts, globalArgs, isJsonOutput } from '~/lib/args'
import { DEFAULT_BASE_URL } from '~/lib/client'
import {
  getConfigPath,
  maskKey,
  resolveApiKey,
  validateBaseUrl
} from '~/lib/config'
import { json } from '~/lib/output'

import { version } from '../../package.json'

interface Check {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export default defineCommand({
  meta: { name: 'doctor', description: 'Run environment diagnostics' },
  args: { ...globalArgs },
  async run({ args }) {
    const checks: Check[] = []
    const jsonMode = isJsonOutput(args)

    if (!jsonMode) {
      console.log()
      console.log(pc.bold('  🩺 sevk Doctor'))
      console.log()
    }

    checks.push({
      name: 'CLI Version',
      status: 'pass',
      message: `v${version}`
    })

    checks.push({
      name: 'Runtime',
      status: 'pass',
      message: `${process.versions.bun ? 'Bun' : 'Node.js'} v${process.versions.bun || process.versions.node} (${process.platform}-${process.arch})`
    })

    let resolved: Awaited<ReturnType<typeof resolveApiKey>> = null

    try {
      resolved = await resolveApiKey(getClientOpts(args))
      if (resolved) {
        checks.push({
          name: 'API Key',
          status: 'pass',
          message: `${maskKey(resolved.key)} (source: ${resolved.source})`
        })
      } else {
        checks.push({
          name: 'API Key',
          status: 'fail',
          message: 'No API key found. Run `sevk login`.'
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : undefined

      checks.push({
        name: 'API Key',
        status: 'fail',
        message: message || 'Could not read credentials.'
      })
    }

    const baseUrl = resolved?.baseUrl || DEFAULT_BASE_URL
    const baseUrlErr = validateBaseUrl(baseUrl)

    if (baseUrlErr) {
      checks.push({ name: 'API Connection', status: 'fail', message: baseUrlErr })
    } else {
      try {
        const res = await fetch(`${baseUrl}/health`)

        if (res.ok) {
          checks.push({
            name: 'API Connection',
            status: 'pass',
            message: `Connected to ${baseUrl}`
          })
        } else {
          checks.push({
            name: 'API Connection',
            status: 'warn',
            message: `${baseUrl} responded with ${res.status}`
          })
        }
      } catch {
        checks.push({
          name: 'API Connection',
          status: 'fail',
          message: `Cannot reach ${baseUrl}`
        })
      }
    }

    let configExists = false

    try {
      await access(getConfigPath()); configExists = true
    } catch { /* ignore */ }

    checks.push({
      name: 'Config',
      status: 'pass',
      message: `${getConfigPath()}${configExists ? '' : pc.dim(' (not created yet)')}`
    })

    if (configExists && process.platform !== 'win32') {
      try {
        const { mode } = await stat(getConfigPath())

        if (mode & 0o077) {
          checks.push({
            name: 'Config Permissions',
            status: 'warn',
            message: `Credentials file is group/other-readable (mode ${(mode & 0o777).toString(8)}). Run \`chmod 600 ${getConfigPath()}\`.`
          })
        } else {
          checks.push({
            name: 'Config Permissions',
            status: 'pass',
            message: 'Credentials file is owner-only (600)'
          })
        }
      } catch { /* ignore */ }
    }

    if (jsonMode) {
      const ok = checks.every((c) => c.status !== 'fail')

      if (!ok) {
        process.exitCode = 1
      }

      json({ ok, checks })

      return
    }

    const icons = { pass: pc.green('✔'), warn: pc.yellow('!'), fail: pc.red('✗') }

    for (const check of checks) {
      console.log(`  ${icons[check.status]} ${pc.bold(check.name)}: ${check.message}`)
    }

    console.log()

    const hasFail = checks.some((c) => c.status === 'fail')

    if (hasFail) {
      process.exitCode = 1
    }
  }
})
