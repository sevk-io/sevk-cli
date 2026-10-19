import { defineCommand } from 'citty'

import get from './get'
import pause from './pause'
import reset from './reset'
import resetLimit from './reset-limit'
import update from './update'

export default defineCommand({
  meta: { name: 'quota', description: 'Manage the outbound monthly quota' },
  subCommands: { get, update, reset, 'reset-limit': resetLimit, pause }
})
