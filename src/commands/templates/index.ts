import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import update from './update'
import del from './delete'
import duplicate from './duplicate'

export default defineCommand({
  meta: { name: 'templates', description: 'Manage email templates' },
  subCommands: { list, create, get, update, delete: del, duplicate },
})
