import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import update from './update'
import del from './delete'
import listContacts from './list-contacts'
import addContact from './add-contact'
import removeContact from './remove-contact'

export default defineCommand({
  meta: { name: 'audiences', description: 'Manage audiences' },
  subCommands: {
    list,
    create,
    get,
    update,
    delete: del,
    'list-contacts': listContacts,
    'add-contact': addContact,
    'remove-contact': removeContact,
  },
})
