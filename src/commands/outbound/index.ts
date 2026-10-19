import { defineCommand } from 'citty'

import quota from './quota/index'

export default defineCommand({
  meta: { name: 'outbound', description: 'Manage outbound sending quota and pause state' },
  subCommands: {
    quota
  }
})
