import { defineCommand } from 'citty'
import subscribe from './subscribe'
import unsubscribe from './unsubscribe'

export default defineCommand({
  meta: { name: 'subscriptions', description: 'Manage contact subscriptions' },
  subCommands: { subscribe, unsubscribe },
})
