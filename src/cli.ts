#!/usr/bin/env node
import { exec } from 'node:child_process'

import { settings } from '@clack/core'
import * as p from '@clack/prompts'
import {
  type CommandDef,
  defineCommand,
  runCommand,
  runMain
} from 'citty'
import pc from 'picocolors'

import { version } from '../package.json'
import activity from './commands/activity/index'
import audiences from './commands/audiences/index'
import auth from './commands/auth'
import broadcasts from './commands/broadcasts/index'
import config from './commands/config'
import contacts from './commands/contacts/index'
import doctor from './commands/doctor'
import domains from './commands/domains/index'
import emails from './commands/emails/index'
import inbound from './commands/inbound/index'
import login from './commands/login'
import logout from './commands/logout'
import markup from './commands/markup/index'
import outbound from './commands/outbound/index'
import segments from './commands/segments/index'
import subscriptions from './commands/subscriptions/index'
import templates from './commands/templates/index'
import topics from './commands/topics/index'
import usage from './commands/usage'
import webhooks from './commands/webhooks/index'
import whoami from './commands/whoami'
import { assertKnownOptions, normalizeGlobalArgs } from './lib/cli-args'
import { createClient } from './lib/client'
import { error, isInteractive, setMenuMode } from './lib/output'

interface CommandRef {
  subCommands?: Record<string, CommandRef>
  meta?: { name?: string, description?: string }
  run?: (...args: unknown[]) => unknown
}

const asRef = (cmd: unknown): CommandRef => cmd as CommandRef
const asCmd = (ref: CommandRef): CommandDef => ({
  meta: ref.meta,
  run: ref.run
    ? context => ref.run?.(context)
    : undefined
})

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
  usage,
  activity,
  webhooks,
  inbound,
  outbound,
  markup,
  doctor
}

const directCommands: Record<string, CommandRef> = {
  usage: asRef(usage),
  doctor: asRef(doctor),
  whoami: asRef(whoami)
}

type Pick = { endpoint: string, labelKey: string, hintKey?: string }
type Action = { value: string, label: string, arg?: string, argHint?: string, argFlag?: string, pick?: Pick }
type SelectOption = { value: string, label: string, hint?: string }

const pickDomain: Pick = { endpoint: '/domains', labelKey: 'domain' }
const pickContact: Pick = { endpoint: '/contacts', labelKey: 'email' }
const pickAudience: Pick = { endpoint: '/audiences', labelKey: 'name' }
const pickBroadcast: Pick = { endpoint: '/broadcasts', labelKey: 'name', hintKey: 'status' }
const pickTemplate: Pick = { endpoint: '/templates', labelKey: 'title' }
const pickWebhook: Pick = { endpoint: '/webhooks', labelKey: 'url' }
const pickInboundEmail: Pick = { endpoint: '/inbound', labelKey: 'subject', hintKey: 'fromAddress' }

const groupedCommands: Record<string, { actions: Action[], ref: CommandRef }> = {
  emails: {
    ref: asRef(emails),
    actions: [
      { value: 'send', label: 'Send an email' },
      { value: 'bulk', label: 'Send bulk emails', arg: 'File path', argHint: 'emails.json' },
      { value: 'update', label: 'Reschedule an email', arg: 'Email ID' },
      { value: 'cancel', label: 'Cancel a scheduled email', arg: 'Email ID' }
    ]
  },
  contacts: {
    ref: asRef(contacts),
    actions: [
      { value: 'list', label: 'List contacts' },
      { value: 'create', label: 'Create a contact' },
      { value: 'get', label: 'Get contact details', pick: pickContact },
      { value: 'update', label: 'Update a contact', pick: pickContact },
      { value: 'delete', label: 'Delete a contact', pick: pickContact },
      { value: 'bulk-import', label: 'Import contacts', arg: 'File path', argHint: 'contacts.csv' },
      { value: 'bulk-update', label: 'Bulk update contacts', arg: 'File path', argHint: 'contacts.json' },
      { value: 'activity', label: 'View contact activity', pick: pickContact }
    ]
  },
  audiences: {
    ref: asRef(audiences),
    actions: [
      { value: 'list', label: 'List audiences' },
      { value: 'create', label: 'Create an audience' },
      { value: 'get', label: 'Get audience details', pick: pickAudience },
      { value: 'update', label: 'Update an audience', pick: pickAudience },
      { value: 'delete', label: 'Delete an audience', pick: pickAudience },
      { value: '_topics', label: '🏷️ Manage topics' },
      { value: '_segments', label: '🎯 Manage segments' }
    ]
  },
  broadcasts: {
    ref: asRef(broadcasts),
    actions: [
      { value: 'list', label: 'List broadcasts' },
      { value: 'create', label: 'Create a broadcast' },
      { value: 'send', label: 'Send a broadcast', pick: pickBroadcast },
      { value: 'get', label: 'Get broadcast details', pick: pickBroadcast },
      { value: 'analytics', label: 'View analytics', pick: pickBroadcast },
      { value: 'status', label: 'Check status', pick: pickBroadcast },
      { value: 'estimate-recipients', label: 'Estimate target recipients' },
      { value: 'cancel', label: 'Cancel a broadcast', pick: pickBroadcast },
      { value: 'delete', label: 'Delete a broadcast', pick: pickBroadcast }
    ]
  },
  templates: {
    ref: asRef(templates),
    actions: [
      { value: 'list', label: 'List templates' },
      { value: 'create', label: 'Create a template' },
      { value: 'get', label: 'Get template details', pick: pickTemplate },
      { value: 'update', label: 'Update a template', pick: pickTemplate },
      { value: 'duplicate', label: 'Duplicate a template', pick: pickTemplate },
      { value: 'delete', label: 'Delete a template', pick: pickTemplate }
    ]
  },
  domains: {
    ref: asRef(domains),
    actions: [
      { value: 'list', label: 'List domains' },
      { value: 'create', label: 'Add a domain' },
      { value: 'get', label: 'Get domain details', pick: pickDomain },
      { value: 'verify', label: 'Verify a domain', pick: pickDomain },
      { value: 'dns-records', label: 'View DNS records', pick: pickDomain },
      { value: 'regions', label: 'List regions' },
      { value: 'delete', label: 'Delete a domain', pick: pickDomain }
    ]
  },
  webhooks: {
    ref: asRef(webhooks),
    actions: [
      { value: 'list', label: 'List webhooks' },
      { value: 'create', label: 'Create a webhook' },
      { value: 'get', label: 'Get webhook details', pick: pickWebhook },
      { value: 'update', label: 'Update a webhook', pick: pickWebhook },
      { value: 'rotate', label: 'Rotate signing secret', pick: pickWebhook },
      { value: 'test', label: 'Test a webhook', pick: pickWebhook },
      { value: 'events', label: 'List webhook events' },
      { value: 'delete', label: 'Delete a webhook', pick: pickWebhook }
    ]
  },
  inbound: {
    ref: asRef(inbound),
    actions: [
      { value: 'list', label: 'List inbound emails' },
      { value: 'get', label: 'Get inbound email details', pick: pickInboundEmail },
      { value: 'delete', label: 'Delete an inbound email', pick: pickInboundEmail },
      { value: 'stats', label: 'Show inbound stats' }
    ]
  },
  outbound: {
    ref: asRef(outbound),
    actions: [
      { value: 'quota_get', label: '📊 Show outbound quota' },
      { value: 'quota_update', label: '✏️ Update user-set cap', arg: 'Monthly email limit (positive integer, or "null" to clear)', argHint: 'e.g. 10000 or null', argFlag: 'monthly-limit' },
      { value: 'quota_reset', label: '▶ Resume sending' },
      { value: 'quota_reset-limit', label: '♻️ Reset limit usage' },
      { value: 'quota_pause', label: '⏸ Pause sending' }
    ]
  },
  activity: {
    ref: asRef(activity),
    actions: [
      { value: 'list', label: 'List activity' },
      { value: 'stats', label: 'View activity stats' }
    ]
  },
  topics: {
    ref: asRef(topics),
    actions: [
      { value: 'list', label: 'List topics' },
      { value: 'create', label: 'Create a topic' },
      { value: 'get', label: 'Get topic details', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'update', label: 'Update a topic', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'delete', label: 'Delete a topic', pick: { endpoint: '', labelKey: 'name' } }
    ]
  },
  segments: {
    ref: asRef(segments),
    actions: [
      { value: 'list', label: 'List segments' },
      { value: 'create', label: 'Create a segment' },
      { value: 'get', label: 'Get segment details', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'calculate', label: 'Calculate segment size', pick: { endpoint: '', labelKey: 'name' } },
      { value: 'delete', label: 'Delete a segment', pick: { endpoint: '', labelKey: 'name' } }
    ]
  },
  subscriptions: {
    ref: asRef(subscriptions),
    actions: [
      { value: 'subscribe', label: 'Subscribe a contact' },
      { value: 'unsubscribe', label: 'Unsubscribe a contact' }
    ]
  },
  markup: {
    ref: asRef(markup),
    actions: [
      { value: 'render', label: 'Render markup to HTML' },
      { value: 'variables', label: 'List variables in markup', arg: 'File path', argHint: 'template.sevk' }
    ]
  },
  config: {
    ref: asRef(config),
    actions: [
      { value: 'show', label: 'Show current configuration' },
      { value: 'set-url', label: 'Set API base URL' },
      { value: 'remove-url', label: 'Remove custom base URL' }
    ]
  }
}

const pickResource = async (pick: Pick): Promise<string | null> => {
  try {
    const client = await createClient({})
    let page = 1
    const limit = 20
    let after: string | undefined
    const history: Array<string | undefined> = []

    while (true) {
      const result = await client.get<{
        items?: unknown
        hasMore?: boolean
        nextCursor?: string | null
      }>(pick.endpoint, { limit, after })
      const items = result.items

      if (!Array.isArray(items) || items.length === 0) {
        console.log(pc.yellow('  No items found.'))

        return null
      }

      const options: SelectOption[] = (items as Record<string, unknown>[]).map((item) => {
        const id = item.id as string
        const hintRaw = pick.hintKey ? item[pick.hintKey] : id

        return {
          value: id,
          label: (item[pick.labelKey] as string) || id,
          hint: hintRaw as string | undefined
        }
      })

      if (history.length > 0) {
        options.push({ value: '__prev__', label: `← Page ${page - 1}` })
      }

      if (result.hasMore && result.nextCursor) {
        options.push({ value: '__next__', label: `→ Page ${page + 1}`, hint: `Page ${page}` })
      }

      options.push({ value: 'back', label: '← Back' })

      const selected = await p.select({
        message: history.length > 0 || result.hasMore ? `Select (Page ${page})` : 'Select',
        options
      })

      if (p.isCancel(selected) || selected === 'back') {
        return null
      }

      if (selected === '__prev__') {
        after = history.pop()
        page--
        continue
      }

      if (selected === '__next__' && result.nextCursor) {
        history.push(after)
        after = result.nextCursor
        page++
        continue
      }

      return selected as string
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)

    console.log(pc.red(`  ✗ ${message}`))

    return null
  }
}

const safeRunCommand = async (cmd: CommandRef, opts: { rawArgs: string[] }): Promise<void> => {
  try {
    await runCommand(asCmd(cmd), opts)
  } catch (err: unknown) {
    error(err)
  }

  process.exitCode = undefined
}

const waitForEnter = (): Promise<void> => {
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
    description: 'sevk CLI - Manage your email infrastructure from the terminal'
  },
  subCommands,
  async run({ rawArgs }) {
    if (!isInteractive()) {
      return
    }

    if (rawArgs && rawArgs.length > 0) {
      return
    }

    process.on('SIGINT', () => {
      console.log()
      process.exit(0)
    })

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
          { value: 'inbound', label: '📥 Inbound', hint: 'Manage incoming email' },
          { value: 'outbound', label: '📤 Outbound', hint: 'Manage outbound quota & pause' },
          { value: 'activity', label: '📊 Activity', hint: 'View activity logs' },
          { value: 'subscriptions', label: '🔔 Subscriptions', hint: 'Subscribe/unsubscribe' },
          { value: 'markup', label: '🖼️ Markup', hint: 'Render sevk Markup' },
          { value: 'usage', label: '📈 Usage', hint: 'View usage & limits' },
          { value: 'doctor', label: '🩺 Doctor', hint: 'Check environment' },
          { value: 'config', label: '⚙️ Config', hint: 'Manage CLI settings' },
          { value: 'whoami', label: '🔑 Who Am I', hint: 'Show auth status' },
          { value: 'bugreport', label: '🐛 Bug Report', hint: 'Report an issue' },
          { value: 'exit', label: '👋 Exit' }
        ]
      })

      if (p.isCancel(group) || group === 'exit') {
        console.log(`  ${pc.dim('Goodbye!')}`)
        console.log()
        process.exit(0)
      }

      const key = group as string

      if (key === 'bugreport') {
        const description = await p.text({
          message: 'Describe the issue',
          placeholder: 'What went wrong?',
          validate: (v) => (!v ? 'Required' : undefined)
        })

        if (p.isCancel(description)) {
          continue
        }

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

      if (directCommands[key]) {
        await safeRunCommand(directCommands[key], { rawArgs: [] })
        await waitForEnter()
        continue
      }

      const grouped = groupedCommands[key]

      if (!grouped) {
        continue
      }

      actionLoop: while (true) {
        const action = await p.select({
          message: `${key} →`,
          options: [
            ...grouped.actions.map(a => ({ value: a.value, label: a.label })),
            { value: 'back', label: '← Back' }
          ]
        })

        if (p.isCancel(action) || action === 'back') {
          break
        }

        if (action === '_topics' || action === '_segments') {
          const audienceId = await pickResource(pickAudience)

          if (!audienceId) {
            continue actionLoop
          }

          const subGroup = action === '_topics' ? 'topics' : 'segments'
          const nestedActions = groupedCommands[subGroup].actions

          nestedLoop: while (true) {
            const subAction = await p.select({
              message: `${subGroup} →`,
              options: [
                ...nestedActions.map(a => ({ value: a.value, label: a.label })),
                { value: 'back', label: '← Back' }
              ]
            })

            if (p.isCancel(subAction) || subAction === 'back') {
              break nestedLoop
            }

            const nestedDef = nestedActions.find(a => a.value === subAction)
            const ref = asRef(subGroup === 'topics' ? topics : segments)
            const subCmd = ref.subCommands?.[subAction as string]

            if (subCmd) {
              const rawArgs: string[] = ['--audience-id', audienceId]

              if (nestedDef?.pick) {
                const dynamicPick: Pick = {
                  endpoint: `/audiences/${audienceId}/${subGroup}`,
                  labelKey: nestedDef.pick.labelKey
                }
                const id = await pickResource(dynamicPick)

                if (!id) {
                  continue nestedLoop
                }

                rawArgs.push(id)
              } else if (nestedDef?.arg) {
                const argValue = await p.text({
                  message: nestedDef.arg,
                  placeholder: nestedDef.argHint || '',
                  validate: (v) => (!v ? 'Required' : undefined)
                })

                if (p.isCancel(argValue)) {
                  continue nestedLoop
                }

                rawArgs.push(argValue as string)
              }

              await safeRunCommand(subCmd, { rawArgs })
              await waitForEnter()
            }
          }

          continue actionLoop
        }

        const actionDef = grouped.actions.find(a => a.value === action)
        let subCmd: CommandRef | undefined = grouped.ref.subCommands?.[action as string]

        if (!subCmd && typeof action === 'string' && action.includes('_')) {
          const segments = (action as string).split('_')
          let cursor: CommandRef | undefined = grouped.ref

          for (const seg of segments) {
            cursor = cursor?.subCommands?.[seg]
            if (!cursor) {
              break
            }
          }

          if (cursor) {
            subCmd = cursor
          }
        }

        if (subCmd) {
          let rawArgs: string[] = []

          if (actionDef?.pick) {
            const id = await pickResource(actionDef.pick)

            if (!id) {
              continue actionLoop
            }

            rawArgs = [id]
          } else if (actionDef?.arg) {
            const argValue = await p.text({
              message: actionDef.arg,
              placeholder: actionDef.argHint || '',
              validate: (v) => (!v ? 'Required' : undefined)
            })

            if (p.isCancel(argValue)) {
              continue actionLoop
            }

            rawArgs = actionDef.argFlag
              ? [`--${actionDef.argFlag}`, argValue as string]
              : [argValue as string]
          }

          await safeRunCommand(subCmd, { rawArgs })
          await waitForEnter()
        }
      }
    }
  }
})

const rawArgs = normalizeGlobalArgs(process.argv.slice(2))

try {
  assertKnownOptions(main, rawArgs)
  await runMain(main, { rawArgs })
} catch (err: unknown) {
  error(err)
  process.exitCode = 1
}
