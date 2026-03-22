import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import update from './update'
import del from './delete'
import events from './events'
import importCmd from './import'
import bulkUpdate from './bulk-update'

export default defineCommand({
  meta: { name: 'contacts', description: 'Manage contacts' },
  subCommands: {
    list,
    create,
    get,
    update,
    delete: del,
    events,
    import: importCmd,
    'bulk-update': bulkUpdate,
  },
})
