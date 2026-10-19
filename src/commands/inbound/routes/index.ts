import { defineCommand } from 'citty'

import create from './create'
import del from './delete'
import get from './get'
import list from './list'
import update from './update'

export default defineCommand({
  meta: { name: 'routes', description: 'Manage inbound forward routes' },
  subCommands: { list, get, create, update, delete: del }
})
