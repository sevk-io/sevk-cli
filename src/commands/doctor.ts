import { defineCommand } from 'citty'
import pc from 'picocolors'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { resolveApiKey, maskKey, getConfigPath } from '~/lib/config'
import { json } from '~/lib/output'
import { SevkClient, DEFAULT_BASE_URL } from '~/lib/client'
import { access } from 'node:fs/promises'
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

    // 1. CLI Version
    checks.push({
      name: 'CLI Version',
      status: 'pass',
      message: `v${version}`,
    })

    // 2. Runtime
    checks.push({
      name: 'Runtime',
      status: 'pass',
      message: `${process.versions.bun ? 'Bun' : 'Node.js'} v${process.versions.bun || process.versions.node} (${process.platform}-${process.arch})`,
    })

    // 3. API Key
    const resolved = await resolveApiKey(getClientOpts(args))
    if (resolved) {
      checks.push({
        name: 'API Key',
        status: 'pass',
        message: `${maskKey(resolved.key)} (source: ${resolved.source})`,
      })
    } else {
      checks.push({
        name: 'API Key',
        status: 'fail',
        message: 'No API key found. Run `sevk login`.',
      })
    }

    // 4. API Connection (health check - no auth needed)
    const baseUrl = resolved?.baseUrl || DEFAULT_BASE_URL
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res.ok) {
        checks.push({
          name: 'API Connection',
          status: 'pass',
          message: `Connected to ${baseUrl}`,
        })
      } else {
        checks.push({
          name: 'API Connection',
          status: 'warn',
          message: `${baseUrl} responded with ${res.status}`,
        })
      }
    } catch {
      checks.push({
        name: 'API Connection',
        status: 'fail',
        message: `Cannot reach ${baseUrl}`,
      })
    }

    // 5. Config
    let configExists = false
    try { await access(getConfigPath()); configExists = true } catch {}
    checks.push({
      name: 'Config',
      status: 'pass',
      message: `${getConfigPath()}${configExists ? '' : pc.dim(' (not created yet)')}`,
    })

    // Output
    if (jsonMode) {
      const ok = checks.every((c) => c.status !== 'fail')
      json({ ok, checks })
      return
    }

    const icons = { pass: pc.green('✔'), warn: pc.yellow('!'), fail: pc.red('✗') }
    for (const check of checks) {
      console.log(`  ${icons[check.status]} ${pc.bold(check.name)}: ${check.message}`)
    }
    console.log()

    const hasFail = checks.some((c) => c.status === 'fail')
    if (hasFail) { process.exitCode = 1 }
  },
})
