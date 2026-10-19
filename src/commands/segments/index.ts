import { defineCommand } from 'citty'

import calculate from './calculate'
import create from './create'
import del from './delete'
import get from './get'
import list from './list'
import preview from './preview'
import update from './update'

export default defineCommand({
  meta: { name: 'segments', description: 'Manage audience segments' },
  subCommands: { list, create, get, update, delete: del, calculate, preview }
})
