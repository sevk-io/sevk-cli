import { defineCommand } from 'citty'

import bulk from './bulk'
import cancel from './cancel'
import get from './get'
import send from './send'
import update from './update'

export default defineCommand({
  meta: { name: 'emails', description: 'Send and manage emails' },
  subCommands: { send, get, bulk, update, cancel }
})
