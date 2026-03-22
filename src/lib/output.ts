import pc from 'picocolors'

const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS
const isTTY = process.stdout.isTTY && !isCI

const hasJsonFlag = process.argv.includes('--json') || process.argv.includes('-q') || process.argv.includes('--quiet')

export function isInteractive(): boolean {
  return isTTY && !hasJsonFlag
}

let _menuMode = false
export function setMenuMode(v: boolean): void { _menuMode = v }
export function isMenuMode(): boolean { return _menuMode }

export function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function success(message: string): void {
  if (isInteractive()) {
    console.log(pc.green(`✓ ${message}`))
  }
}

export function error(message: string): void {
  if (isInteractive()) {
    console.error(pc.red(`✗ ${message}`))
  } else {
    console.error(JSON.stringify({ error: { message } }))
  }
}

export function warn(message: string): void {
  if (isInteractive()) {
    console.warn(pc.yellow(`! ${message}`))
  }
}

export function info(message: string): void {
  if (isInteractive()) {
    console.log(pc.dim(message))
  }
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString()
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

export function shouldOutputJson(opts: { json?: boolean; quiet?: boolean }): boolean {
  return !!opts.json || !!opts.quiet || !isInteractive()
}
