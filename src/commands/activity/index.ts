import { defineCommand } from 'citty'

import list from './list'
import stats from './stats'

export default defineCommand({
  meta: { name: 'activity', description: 'View project activity and statistics' },
  subCommands: { list, stats }
})
