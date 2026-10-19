import { defineCommand } from 'citty'

import get from './get'
import update from './update'

export default defineCommand({
  meta: { name: 'security', description: 'Manage inbound security config per domain' },
  subCommands: { get, update }
})
