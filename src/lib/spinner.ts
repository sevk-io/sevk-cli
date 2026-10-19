import * as p from '@clack/prompts'

import { isInteractive } from './output'

interface SpinnerOptions<T> {
  start: string
  success?: string | ((result: T) => string)
  fail?: string
}

export const withSpinner = async <T>(
  opts: SpinnerOptions<T>,
  fn: () => Promise<T>
): Promise<T> => {
  if (!isInteractive()) {
    return fn()
  }

  const s = p.spinner()

  s.start(opts.start)

  try {
    const result = await fn()
    const msg = typeof opts.success === 'function' ? opts.success(result) : (opts.success || 'Done')

    s.stop(msg)

    return result
  } catch (err: unknown) {
    s.stop(opts.fail || (err instanceof Error ? err.message : 'Failed'))
    throw err
  }
}
