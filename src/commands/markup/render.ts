import { defineCommand } from 'citty'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { render } from 'sevk'
import { error, isInteractive } from '~/lib/output'

export default defineCommand({
  meta: { name: 'render', description: 'Render sevk markup to HTML' },
  args: {
    file: { type: 'positional', description: 'Markup file to render', required: false },
    markup: { type: 'string', alias: 'm', description: 'Markup string to render' },
    output: { type: 'string', alias: 'o', description: 'Output file (default: stdout)' },
    copy: { type: 'boolean', alias: 'c', description: 'Copy output to clipboard' },
  },
  async run({ args }) {
    let markup: string

    if (args.markup) {
      markup = args.markup
    } else if (args.file) {
      try {
        markup = await readFile(args.file, 'utf-8')
      } catch {
        error(`File not found: ${args.file}`)
        process.exitCode = 1; return
      }
    } else if (isInteractive()) {
      const source = await p.select({
        message: 'Input source',
        options: [
          { value: 'file', label: 'From file' },
          { value: 'inline', label: 'Write markup inline' },
        ],
      })
      if (p.isCancel(source)) return

      if (source === 'file') {
        const filePath = await p.text({
          message: 'File path',
          placeholder: 'template.sevk',
          validate: (v) => (!v ? 'Required' : undefined),
        })
        if (p.isCancel(filePath)) return
        try {
          markup = await readFile(filePath, 'utf-8')
        } catch {
          error(`File not found: ${filePath}`)
          process.exitCode = 1; return
        }
      } else {
        const content = await p.text({
          message: 'sevk markup',
          placeholder: '<section><heading>Hello</heading></section>',
          validate: (v) => (!v ? 'Required' : undefined),
        })
        if (p.isCancel(content)) return
        markup = content as string
      }
    } else {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) chunks.push(chunk)
      markup = Buffer.concat(chunks).toString('utf-8')

      if (!markup.trim()) {
        error('No input. Provide a file, --markup, or pipe via stdin.')
        process.exitCode = 1; return
      }
    }

    try {
      const html = render(markup)

      if (args.copy) {
        await copyToClipboard(html)
        console.log(`${pc.green('✔')} Copied to clipboard`)
      } else if (args.output) {
        await writeFile(args.output, html, 'utf-8')
        console.log(`Rendered to ${args.output}`)
      } else if (isInteractive()) {
        const output = await p.select({
          message: 'Output',
          options: [
            { value: 'clipboard', label: 'Copy to clipboard' },
            { value: 'stdout', label: 'Print to stdout' },
            { value: 'file', label: 'Save to file' },
          ],
        })
        if (p.isCancel(output)) return

        if (output === 'clipboard') {
          await copyToClipboard(html)
          console.log(`${pc.green('✔')} Copied to clipboard`)
        } else if (output === 'file') {
          const outPath = await p.text({
            message: 'Output file',
            placeholder: 'output.html',
            validate: (v) => (!v ? 'Required' : undefined),
          })
          if (p.isCancel(outPath)) return
          await writeFile(outPath, html, 'utf-8')
          console.log(`${pc.green('✔')} Rendered to ${outPath}`)
        } else {
          console.log()
          process.stdout.write(html)
          console.log()
        }
      } else {
        process.stdout.write(html)
      }
    } catch (err: any) {
      error(`Render failed: ${err.message}`)
      process.exitCode = 1; return
    }
  },
})

function copyToClipboard(text: string): Promise<void> {
  const cmd = process.platform === 'win32'
    ? { bin: 'clip', args: [] as string[] }
    : process.platform === 'darwin'
      ? { bin: 'pbcopy', args: [] as string[] }
      : { bin: 'xclip', args: ['-selection', 'clipboard'] }

  return new Promise((resolve, reject) => {
    const proc = spawn(cmd.bin, cmd.args, { stdio: ['pipe', 'ignore', 'ignore'] })
    proc.stdin.write(text)
    proc.stdin.end()
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`clipboard exit ${code}`)))
    proc.on('error', reject)
  })
}
