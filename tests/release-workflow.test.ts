import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

interface ReleaseStep {
  run?: string
  shell?: string
  'continue-on-error'?: boolean
}

interface ReleaseWorkflow {
  jobs: {
    build: {
      steps: ReleaseStep[]
    }
  }
}

const workflow = Bun.YAML.parse(readFileSync(join(import.meta.dir, '../.github/workflows/release.yml'), 'utf8')) as ReleaseWorkflow

describe('CLI release workflow', () => {
  test('propagates each build check failure on Windows', () => {
    for (const command of ['bun run build', 'bun run test', 'bun run typecheck']) {
      const step = workflow.jobs.build.steps.find(step => step.run?.trim() === command)

      expect(step).toBeDefined()
      expect(step?.['continue-on-error']).not.toBeTrue()
    }
  })

  test('requires a lockfile before installing frozen dependencies', () => {
    const steps = workflow.jobs.build.steps
    const lockCheckIndex = steps.findIndex(step => step.shell === 'bash' && step.run?.trim() === 'test -f bun.lock')
    const installIndex = steps.findIndex(step => step.run?.trim() === 'bun install --frozen-lockfile')

    expect(lockCheckIndex).toBeGreaterThanOrEqual(0)
    expect(installIndex).toBeGreaterThan(lockCheckIndex)
    expect(steps[lockCheckIndex]?.['continue-on-error']).not.toBeTrue()
  })
})
