import { defineCommand } from 'citty'

import add from './add'
import list from './list'
import remove from './remove'

export default defineCommand({
  meta: { name: 'blocklist', description: 'Manage the inbound blocklist' },
  subCommands: { list, add, remove }
})
