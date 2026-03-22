import { defineCommand } from 'citty'
import list from './list'
import stats from './stats'

export default defineCommand({
  meta: { name: 'events', description: 'View project events and statistics' },
  subCommands: { list, stats },
})
