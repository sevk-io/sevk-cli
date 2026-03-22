import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import update from './update'
import del from './delete'
import test from './test'
import events from './events'

export default defineCommand({
  meta: { name: 'webhooks', description: 'Manage webhooks' },
  subCommands: { list, create, get, update, delete: del, test, events },
})
