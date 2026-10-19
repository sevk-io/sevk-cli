import pc from 'picocolors'

const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS
const isTTY = process.stdout.isTTY && !isCI

const isTruthyFlag = (flag: string): boolean => {
  return process.argv.some((a) => {
    if (a === flag) {
      return true
    }

    if (a.startsWith(`${flag}=`)) {
      const v = a.slice(flag.length + 1).toLowerCase()

      return v !== 'false' && v !== '0' && v !== ''
    }

    return false
  })
}

const hasJsonFlag = isTruthyFlag('--json') || isTruthyFlag('--quiet') || process.argv.includes('-q')

export const isInteractive = (): boolean => {
  return isTTY && !hasJsonFlag
}

let _menuMode = false

export const setMenuMode = (v: boolean): void => {
  _menuMode = v
}

export const isMenuMode = (): boolean => _menuMode

export const json = (data: unknown): void => {
  console.log(JSON.stringify(data, null, 2))
}

export const success = (message: string): void => {
  if (isInteractive()) {
    console.log(pc.green(`✓ ${message}`))
  }
}

export const error = (input: unknown): void => {
  const obj: { message?: string, statusCode?: number, code?: string, fields?: unknown, retryAfter?: number, details?: unknown } =
    typeof input === 'string'
      ? { message: input }
      : input && typeof input === 'object'
        ? input as { message?: string, statusCode?: number, code?: string, fields?: unknown, retryAfter?: number, details?: unknown }
        : { message: String(input) }
  const message = obj.message || 'Unknown error'

  if (isInteractive()) {
    const retry = obj.retryAfter === undefined ? '' : ` (retry after ${obj.retryAfter}s)`
    console.error(pc.red(`✗ ${message}${retry}`))
  } else {
    const payload: Record<string, unknown> = { message }

    if (obj.statusCode !== undefined) {
      payload.statusCode = obj.statusCode
    }

    if (obj.code !== undefined) {
      payload.code = obj.code
    }

    if (obj.fields !== undefined) {
      payload.fields = obj.fields
    }

    if (obj.retryAfter !== undefined) {
      payload.retryAfter = obj.retryAfter
    }

    if (obj.details !== undefined) {
      payload.details = obj.details
    }

    console.error(JSON.stringify({ error: payload }))
  }
}

export const warn = (message: string): void => {
  if (isInteractive()) {
    console.warn(pc.yellow(`! ${message}`))
  }
}

export const info = (message: string): void => {
  if (isInteractive()) {
    console.log(pc.dim(message))
  }
}

export const shouldOutputJson = (opts: { json?: boolean, quiet?: boolean }): boolean => {
  return !!opts.json || !!opts.quiet || !isInteractive()
}
