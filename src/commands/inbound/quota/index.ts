import { defineCommand } from 'citty'

import get from './get'
import reset from './reset'
import update from './update'

export default defineCommand({
  meta: { name: 'quota', description: 'Manage the inbound monthly quota' },
  subCommands: { get, update, reset }
})
