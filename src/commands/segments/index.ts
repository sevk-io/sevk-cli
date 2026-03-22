import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import update from './update'
import del from './delete'
import calculate from './calculate'
import preview from './preview'

export default defineCommand({
  meta: { name: 'segments', description: 'Manage audience segments' },
  subCommands: { list, create, get, update, delete: del, calculate, preview },
})
