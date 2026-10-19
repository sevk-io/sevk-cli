import { defineCommand } from 'citty'

import create from './create'
import del from './delete'
import duplicate from './duplicate'
import get from './get'
import list from './list'
import update from './update'

export default defineCommand({
  meta: { name: 'templates', description: 'Manage email templates' },
  subCommands: { list, create, get, update, delete: del, duplicate }
})
