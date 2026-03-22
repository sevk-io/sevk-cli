import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { globalArgs, getClientOpts, isJsonOutput } from '~/lib/args'
import { createClient } from '~/lib/client'
import { json, error, isInteractive } from '~/lib/output'
import { writeFile } from 'node:fs/promises'

export default defineCommand({
  meta: { name: 'generate', description: 'Generate an email with AI' },
  args: {
    ...globalArgs,
    prompt: { type: 'positional', description: 'Describe the email you want to generate', required: false },
    output: { type: 'string', alias: 'o', description: 'Output file path (e.g. email.sevk)' },
  },
  async run({ args }) {
    let prompt = args.prompt

    if (!prompt && isInteractive()) {
      const result = await p.text({
        message: 'Describe the email you want to generate (empty to go back)',
        placeholder: 'Create a welcome email for new users with a purple CTA button',
      })
      if (p.isCancel(result) || !result) return
      prompt = result
    }

    if (!prompt) {
      error('Prompt is required. Usage: sevk generate "your prompt here"')
      process.exitCode = 1; return
    }

    const client = await createClient(getClientOpts(args))
    const jsonMode = isJsonOutput(args)

    try {
      // 1. Create a chat
      const chat = await client.post<any>('/ai/chats', {
        title: prompt.slice(0, 100),
      })

      if (!jsonMode) {
        console.log()
        process.stdout.write(pc.dim('  Generating'))
      }

      // 2. Generate via SSE stream
      const stream = await client.stream(`/ai/chats/${chat.id}/generate`, {
        prompt,
      })

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''
      let usageInfo: any = null
      let streamError: string | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const jsonStr = line.substring(5).trim()
          if (jsonStr === '[DONE]') continue

          try {
            const data = JSON.parse(jsonStr)

            if (data.error) {
              streamError = data.error
              if (data.balanceError) {
                streamError = `Insufficient balance (${data.balanceError.balanceFormatted}). Add credits at app.sevk.io.`
              }
              continue
            }

            if (data.content) {
              fullContent += data.content
              if (!jsonMode) {
                process.stdout.write(pc.dim('.'))
              }
            }

            if (data.usage) {
              usageInfo = data.usage
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      if (!jsonMode) {
        console.log()
      }

      if (streamError) {
        error(streamError)
        process.exitCode = 1; return
      }

      // Clean up content
      let markup = fullContent.trim()
      if (markup.startsWith('```html')) markup = markup.substring(7)
      else if (markup.startsWith('```')) markup = markup.substring(3)
      if (markup.endsWith('```')) markup = markup.substring(0, markup.length - 3)
      markup = markup.trim()

      if (!markup) {
        error('No content was generated.')
        process.exitCode = 1; return
      }

      // Output
      if (jsonMode) {
        json({
          markup,
          usage: usageInfo ? {
            tokens: usageInfo.totalTokens,
            cost: usageInfo.cost,
            isFree: usageInfo.isFree,
            balanceAfter: usageInfo.balanceAfter,
            quotaUsed: usageInfo.quotaUsed,
            quotaLimit: usageInfo.quotaLimit,
          } : null,
        })
      } else {
        console.log()
        console.log(pc.bold('  Generated Markup'))
        console.log(pc.dim('  ─'.repeat(30)))
        console.log()
        for (const line of markup.split('\n')) {
          console.log(`  ${line}`)
        }
        console.log()

        if (usageInfo) {
          console.log(pc.dim('  ─'.repeat(30)))
          const costStr = usageInfo.isFree
            ? pc.green('FREE') + pc.dim(` (${usageInfo.quotaUsed}/${usageInfo.quotaLimit} free quota)`)
            : pc.yellow(`$${usageInfo.cost?.toFixed(6) || '0'}`)
          console.log(`  ${pc.dim('Cost:')}       ${costStr}`)
          console.log(`  ${pc.dim('Tokens:')}     ${usageInfo.totalTokens || '—'}`)
          if (!usageInfo.isFree && usageInfo.balanceAfter != null) {
            console.log(`  ${pc.dim('Balance:')}    $${Number(usageInfo.balanceAfter).toFixed(4)}`)
          }
          console.log()
        }
      }

      // Write to file if --output specified
      if (args.output) {
        await writeFile(args.output, markup, 'utf-8')
        if (!jsonMode) {
          console.log(`  ${pc.green('✔')} Saved to ${args.output}`)
          console.log()
        }
      }

    } catch (err: any) {
      error(err.message)
      process.exitCode = 1; return
    }
  },
})
