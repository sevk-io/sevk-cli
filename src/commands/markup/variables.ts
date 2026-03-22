import { defineCommand } from 'citty'
import { readFile } from 'node:fs/promises'
import { error } from '~/lib/output'


export default defineCommand({
  meta: { name: 'variables', description: 'List variables used in a markup file' },
  args: {
    file: { type: 'positional', description: 'Markup file to scan', required: true },
  },
  async run({ args }) {
    let content: string

    try {
      content = await readFile(args.file, 'utf-8')
    } catch {
      error(`Cannot read file: ${args.file}`)
      process.exitCode = 1; return
    }

    // Extract all {{variable}} patterns
    const matches = content.matchAll(/\{\{(.+?)\}\}/g)
    const variables = new Set<string>()

    for (const match of matches) {
      const raw = match[1].trim()
      // Handle fallback syntax: {{var ?? fallback}}
      const varName = raw.split('??')[0].trim()
      variables.add(varName)
    }

    if (variables.size === 0) {
      console.log('No variables found.')
      return
    }

    console.log(`Found ${variables.size} variable(s):\n`)
    for (const v of variables) {
      console.log(`  {{${v}}}`)
    }
  },
})
