import { defineCommand } from 'citty'

import create from './create'
import del from './delete'
import events from './events'
import get from './get'
import list from './list'
import rotate from './rotate'
import test from './test'
import update from './update'

export default defineCommand({
  meta: { name: 'webhooks', description: 'Manage webhooks' },
  subCommands: { list, create, get, update, rotate, delete: del, test, events }
})
