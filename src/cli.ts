#!/usr/bin/env node
import { defineCommand, runMain, runCommand } from 'citty'
import { version } from '../package.json'
import login from './commands/login'
import logout from './commands/logout'
import whoami from './commands/whoami'
import auth from './commands/auth'
import config from './commands/config'
import emails from './commands/emails/index'
import domains from './commands/domains/index'
import contacts from './commands/contacts/index'
import audiences from './commands/audiences/index'
import broadcasts from './commands/broadcasts/index'
import templates from './commands/templates/index'
import topics from './commands/topics/index'
import segments from './commands/segments/index'
import subscriptions from './commands/subscriptions/index'
import generate from './commands/generate'
import usage from './commands/usage'
import events from './commands/events/index'
import webhooks from './commands/webhooks/index'
import markup from './commands/markup/index'
import doctor from './commands/doctor'
import * as p from '@clack/prompts'
import { settings } from '@clack/core'
import pc from 'picocolors'
import { exec } from 'node:child_process'
import { isInteractive, setMenuMode } from './lib/output'
import { createClient } from './lib/client'

const subCommands = {
  login,
  logout,
  whoami,
  auth,
  config,
  emails,
  domains,
  contacts,
  audiences,
  broadcasts,
  templates,
  topics,
  segments,
  subscriptions,
  generate,
  usage,
  events,
  webhooks,
  markup,
  doctor,
}

// Map of group → sub-actions with their command references
const directCommands: Record<string, any> = {
  generate,
  usage,
  doctor,
  whoami,
}

type Pick = { endpoint: string; labelKey: string; hintKey?: string }
type Action = { value: string; label: string; arg?: string; argHint?: string; pick?: Pick }

const pickDomain: Pick = { endpoint: '/domains', labelKey: 'domain' }
const pickContact: Pick = { endpoint: '/contacts', labelKey: 'email' }
const pickAudience: Pick = { endpoint: '/audiences', labelKey: 'name' }
const pickBroadcast: Pick = { endpoint: '/broadcasts', labelKey: 'name', hintKey: 'status' }
const pickTemplate: Pick = { endpoint: '/templates', labelKey: 'title' }
const pickWebhook: Pick = { endpoint: '/webhooks', labelKey: 'url' }
// pickTopic and pickSegment are dynamic — built per-audience in the nested loop

const groupedCommands: Record<string, { actions: Action[]; ref: any }> = {
  emails: {
    ref: emails,
    actions: [
      { value: 'send', label: 'Send an email' },
      { value: 'bulk', label: 'Send bulk emails', arg: 'File path', argHint: 'emails.json' },
    ],
  },
  contacts: {
    ref: contacts,
    actions: [
      { value: 'list', label: 'List contacts' },
      { value: 'create', label: 'Create a contact' },
      { value: 'get', label: 'Get contact details', pick: pickContact },
      { value: 'update', label: 'Update a contact', pick: pickContact },
      { value: 'delete', label: 'Delete a contact', pick: pickContact },
      { value: 'import', label: 'Import contacts', arg: 'File path', argHint: 'contacts.csv' },
      { value: 'events', label: 'View contact events', pick: pickContact },
    ],
  },
  audiences: {
    ref: audiences,
    actions: [
      { value: 'list', label: 'List audiences' },
      { value: 'create', label: 'Create an audience' },
      { value: 'get', label: 'Get audience details', pick: pickAudience },
      { value: 'update', label: 'Update an audience', pick: pickAudience },
      { value: 'delete', label: 'Delete an audience', pick: pickAudience },
      { value: '_topics', label: '🏷️ Manage topics' },
      { value: '_segments', label: '🎯 Manage segments' },
    ],
  },
  broadcasts: {
    ref: broadcasts,
    actions: [
      { value: 'list', label: 'List broadcasts' },
      { value: 'create', label: 'Create a broadcast' },
      { value: 'send', label: 'Send a broadcast', pick: pickBroadcast },
      { value: 'get', label: 'Get broadcast details', pick: pickBroadcast },
      { value: 'analytics', label: 'View analytics', pick: pickBroadcast },
      { value: 'status', label: 'Check status', pick: pickBroadcast },
      { value: 'cancel', label: 'Cancel a broadcast', pick: pickBroadcast },
      { value: 'delete', label: 'Delete a broadcast', pick: pickBroadcast },
    ],
  },
  templates: {
    ref: templates,
    actions: [
      { value: 'list', label: 'List templates' },
      { value: 'create', label: 'Create a template' },
      { value: 'get', label: 'Get template details', pick: pickTemplate },
      { value: 'update', label: 'Update a template', pick: pickTemplate },
      { value: 'duplicate', label: 'Duplicate a template', pick: pickTemplate },
      { value: 'delete', label: 'Delete a template', pick: pickTemplate },
    ],
  },
  domains: {
    ref: domains,
    actions: [
      { value: 'list', label: 'List domains' },
      { value: 'create', label: 'Add a domain' },
      { value: 'get', label: 'Get domain details', pick: pickDomain },
      { value: 'verify', label: 'Verify a domain', pick: pickDomain },
      { value: 'dns-records', label: 'View DNS records', pick: pickDomain },
      { value: 'regions', label: 'List regions' },
      { value: 'delete', label: 'Delete a domain', pick: pickDomain },
    ],
  },
  webhooks: {
    ref: webhooks,
    actions: [
      { value: 'list', label: 'List webhooks' },
      { value: 'create', label: 'Create a webhook' },
      { value: 'get', label: 'Get webhook details', pick: pickWebhook },
      { value: 'update', label: 'Update a webhook', pick: pickWebhook },
      { value: 'test', label: 'Test a webhook', pick: pickWebhook },
      { value: 'events', label: 'List webhook events' },
      { value: 'delete', label: 'Delete a webhook', pick: pickWebhook },
    ],
  },
  events: {
    ref: events,
    actions: [
      { value: 'list', label: 'List events' },
      { value: 'stats', label: 'View event stats' },
    ],
  },
  topics: {
    ref: topics,
    actions: [
      { value: 'list', label: 'List topics' },
      { value: 'create', label: 'Create a topic' },
      { value: 'get', label: 'Get topic details', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'update', label: 'Update a topic', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'delete', label: 'Delete a topic', pick: { endpoint: '', labelKey: 'name' } },
    ],
  },
  segments: {
    ref: segments,
    actions: [
      { value: 'list', label: 'List segments' },
      { value: 'create', label: 'Create a segment' },
      { value: 'get', label: 'Get segment details', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'calculate', label: 'Calculate segment size', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'delete', label: 'Delete a segment', pick: { endpoint: '', labelKey: 'name' } },
    ],
  },
  subscriptions: {
    ref: subscriptions,
    actions: [
      { value: 'subscribe', label: 'Subscribe a contact' },
      { value: 'unsubscribe', label: 'Unsubscribe a contact' },
    ],
  },
  markup: {
    ref: markup,
    actions: [
      { value: 'render', label: 'Render markup to HTML' },
      { value: 'variables', label: 'List variables in markup', arg: 'File path', argHint: 'template.sevk' },
    ],
  },
  config: {
    ref: config,
    actions: [
      { value: 'show', label: 'Show current configuration' },
      { value: 'set-url', label: 'Set API base URL' },
      { value: 'remove-url', label: 'Remove custom base URL' },
    ],
  },
}

async function pickResource(pick: Pick): Promise<string | null> {
  try {
    const client = await createClient({})
    let page = 1
    const limit = 20

    while (true) {
      const result = await client.get<any>(pick.endpoint, { page, limit })
      const items = result.items || result
      const total = result.total || 0
      const totalPages = Math.ceil(total / limit) || 1

      if (!Array.isArray(items) || items.length === 0) {
        console.log(pc.yellow('  No items found.'))
        return null
      }

      const options: any[] = items.map((item: any) => ({
        value: item.id,
        label: item[pick.labelKey] || item.id,
        hint: pick.hintKey ? item[pick.hintKey] : item.id,
      }))

      if (totalPages > 1) {
        if (page > 1) options.push({ value: '__prev__', label: `← Page ${page - 1}` })
        if (page < totalPages) options.push({ value: '__next__', label: `→ Page ${page + 1}`, hint: `${page}/${totalPages}` })
      }
      options.push({ value: 'back', label: '← Back' })

      const selected = await p.select({
        message: totalPages > 1 ? `Select (${page}/${totalPages})` : 'Select',
        options,
      })

      if (p.isCancel(selected) || selected === 'back') return null
      if (selected === '__prev__') { page--; continue }
      if (selected === '__next__') { page++; continue }
      return selected as string
    }
  } catch (err: any) {
    console.log(pc.red(`  ✗ ${err.message}`))
    return null
  }
}

async function safeRunCommand(cmd: any, opts: { rawArgs: string[] }): Promise<void> {
  try {
    await runCommand(cmd, opts)
  } catch {}
  process.exitCode = undefined as any
}

function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    console.log()
    console.log(pc.dim('  ← Enter to go back'))
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.once('data', () => {
      process.stdin.setRawMode?.(false)
      process.stdin.pause()
      resolve()
    })
  })
}

const main = defineCommand({
  meta: {
    name: 'sevk',
    version,
    description: 'sevk CLI - Manage your email infrastructure from the terminal',
  },
  subCommands,
  async run({ rawArgs }) {
    if (!isInteractive()) return
    // If a sub-command was passed (e.g. `sevk usage`), don't show interactive menu
    if (rawArgs && rawArgs.length > 0) return

    process.on('SIGINT', () => {
      console.log()
      process.exit(0)
    })

    // Disable ESC as cancel to prevent stdin corruption on Bun
    settings.aliases.delete('escape')

    setMenuMode(true)

    console.log()
    console.log(`  ${pc.bold('sevk')} ${pc.dim(`v${version}`)}`)
    console.log()

    while (true) {
      const group = await p.select({
        message: 'What would you like to do?',
        options: [
          { value: 'emails', label: '📧 Emails', hint: 'Send and manage emails' },
          { value: 'contacts', label: '👤 Contacts', hint: 'Manage contacts' },
          { value: 'audiences', label: '👥 Audiences', hint: 'Manage audiences' },
          { value: 'broadcasts', label: '📢 Broadcasts', hint: 'Send broadcasts' },
          { value: 'templates', label: '📝 Templates', hint: 'Manage templates' },
          { value: 'domains', label: '🌐 Domains', hint: 'Manage domains' },
          { value: 'webhooks', label: '🔗 Webhooks', hint: 'Manage webhooks' },
          { value: 'events', label: '📊 Events', hint: 'View event logs' },
          { value: 'subscriptions', label: '🔔 Subscriptions', hint: 'Subscribe/unsubscribe' },
          { value: 'generate', label: '✨ Generate', hint: 'Generate email with AI' },
          { value: 'markup', label: '🖼️ Markup', hint: 'Render sevk Markup' },
          { value: 'usage', label: '📈 Usage', hint: 'View usage & limits' },
          { value: 'doctor', label: '🩺 Doctor', hint: 'Check environment' },
          { value: 'config', label: '⚙️ Config', hint: 'Manage CLI settings' },
          { value: 'whoami', label: '🔑 Who Am I', hint: 'Show auth status' },
          { value: 'bugreport', label: '🐛 Bug Report', hint: 'Report an issue' },
          { value: 'exit', label: '👋 Exit' },
        ],
      })

      if (p.isCancel(group) || group === 'exit') {
        console.log(`  ${pc.dim('Goodbye!')}`)
        console.log()
        process.exit(0)
      }

      const key = group as string

      // Bug report
      if (key === 'bugreport') {
        const description = await p.text({
          message: 'Describe the issue',
          placeholder: 'What went wrong?',
          validate: (v) => (!v ? 'Required' : undefined),
        })
        if (p.isCancel(description)) continue

        const subject = encodeURIComponent(`[CLI Bug] ${(description as string).slice(0, 50)}`)
        const body = encodeURIComponent(`**Description:**\n${description}\n\n**CLI Version:** ${version}\n**Platform:** ${process.platform} ${process.arch}\n**Runtime:** ${typeof Bun !== 'undefined' ? 'Bun' : 'Node.js'} ${process.version}`)
        const url = `mailto:dev@sevk.io?subject=${subject}&body=${body}`

        const openCmd = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open'
        exec(`${openCmd} "${url}"`)

        console.log()
        console.log(`  ${pc.green('✔')} Opening mail client...`)
        console.log(`  ${pc.dim('Or email directly:')} dev@sevk.io`)
        await waitForEnter()
        continue
      }

      // Direct commands
      if (directCommands[key]) {
        await safeRunCommand(directCommands[key], { rawArgs: [] })
        await waitForEnter()
        continue
      }

      // Topics/Segments require audience selection first
      if (key === 'topics' || key === 'segments') {
        const audienceId = await pickResource(pickAudience)
        if (!audienceId) continue

        const subGroup = key
        const nestedActions = groupedCommands[subGroup].actions

        nestedLoop2: while (true) {
          const subAction = await p.select({
            message: `${subGroup} →`,
            options: [
              ...nestedActions.map(a => ({ value: a.value, label: a.label })),
              { value: 'back', label: '← Back' },
            ],
          })

          if (p.isCancel(subAction) || subAction === 'back') break nestedLoop2

          const nestedDef = nestedActions.find(a => a.value === subAction)
          const ref = subGroup === 'topics' ? topics : segments
          const subCmd = (ref as any).subCommands?.[subAction as string]
          if (subCmd) {
            let rawArgs: string[] = ['--audience-id', audienceId]
            if (nestedDef?.pick) {
              const dynamicPick: Pick = {
                endpoint: `/audiences/${audienceId}/${subGroup}`,
                labelKey: nestedDef.pick.labelKey,
              }
              const id = await pickResource(dynamicPick)
              if (!id) continue nestedLoop2
              rawArgs.push(id)
            } else if (nestedDef?.arg) {
              const argValue = await p.text({
                message: nestedDef.arg,
                placeholder: nestedDef.argHint || '',
                validate: (v) => (!v ? 'Required' : undefined),
              })
              if (p.isCancel(argValue)) continue nestedLoop2
              rawArgs.push(argValue as string)
            }
            await safeRunCommand(subCmd, { rawArgs })
            await waitForEnter()
          }
        }
        continue
      }

      // Grouped commands
      const grouped = groupedCommands[key]
      if (!grouped) continue

      actionLoop: while (true) {
        const action = await p.select({
          message: `${key} →`,
          options: [
            ...grouped.actions.map(a => ({ value: a.value, label: a.label })),
            { value: 'back', label: '← Back' },
          ],
        })

        if (p.isCancel(action) || action === 'back') break

        // Handle nested audience sub-menus (topics/segments)
        if (action === '_topics' || action === '_segments') {
          const audienceId = await pickResource(pickAudience)
          if (!audienceId) continue actionLoop

          const subGroup = action === '_topics' ? 'topics' : 'segments'
          const nestedActions = groupedCommands[subGroup].actions

          nestedLoop: while (true) {
            const subAction = await p.select({
              message: `${subGroup} →`,
              options: [
                ...nestedActions.map(a => ({ value: a.value, label: a.label })),
                { value: 'back', label: '← Back' },
              ],
            })

            if (p.isCancel(subAction) || subAction === 'back') break nestedLoop

            const nestedDef = nestedActions.find(a => a.value === subAction)
            const ref = subGroup === 'topics' ? topics : segments
            const subCmd = (ref as any).subCommands?.[subAction as string]
            if (subCmd) {
              let rawArgs: string[] = ['--audience-id', audienceId]
              if (nestedDef?.pick) {
                const dynamicPick: Pick = {
                  endpoint: `/audiences/${audienceId}/${subGroup}`,
                  labelKey: nestedDef.pick.labelKey,
                }
                const id = await pickResource(dynamicPick)
                if (!id) continue nestedLoop
                rawArgs.push(id)
              } else if (nestedDef?.arg) {
                const argValue = await p.text({
                  message: nestedDef.arg,
                  placeholder: nestedDef.argHint || '',
                  validate: (v) => (!v ? 'Required' : undefined),
                })
                if (p.isCancel(argValue)) continue nestedLoop
                rawArgs.push(argValue as string)
              }
              await safeRunCommand(subCmd, { rawArgs })
              await waitForEnter()
            }
          }
          continue actionLoop
        }

        // Run the sub-command
        const actionDef = grouped.actions.find(a => a.value === action)
        const subCmd = (grouped.ref as any).subCommands?.[action as string]
        if (subCmd) {
          let rawArgs: string[] = []

          if (actionDef?.pick) {
            const id = await pickResource(actionDef.pick)
            if (!id) continue actionLoop
            rawArgs = [id]
          } else if (actionDef?.arg) {
            const argValue = await p.text({
              message: actionDef.arg,
              placeholder: actionDef.argHint || '',
              validate: (v) => (!v ? 'Required' : undefined),
            })
            if (p.isCancel(argValue)) continue actionLoop
            rawArgs = [argValue as string]
          }

          await safeRunCommand(subCmd, { rawArgs })
          await waitForEnter()
        }
      }
    }
  },
})

runMain(main)
