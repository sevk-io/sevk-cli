import { defineCommand } from 'citty'
import send from './send'
import get from './get'
import bulk from './bulk'

export default defineCommand({
  meta: { name: 'emails', description: 'Send and manage emails' },
  subCommands: { send, get, bulk },
})
