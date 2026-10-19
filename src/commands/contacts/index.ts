import { defineCommand } from 'citty'

import activity from './activity'
import bulkUpdate from './bulk-update'
import create from './create'
import del from './delete'
import get from './get'
import bulkImport from './import'
import list from './list'
import update from './update'

export default defineCommand({
  meta: { name: 'contacts', description: 'Manage contacts' },
  subCommands: {
    list,
    create,
    get,
    update,
    delete: del,
    activity,
    'bulk-import': bulkImport,
    'bulk-update': bulkUpdate
  }
})
