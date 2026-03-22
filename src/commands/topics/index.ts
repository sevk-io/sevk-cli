import { defineCommand } from 'citty'
import list from './list'
import create from './create'
import get from './get'
import update from './update'
import del from './delete'
import addContact from './add-contact'
import removeContact from './remove-contact'
import listContacts from './list-contacts'

export default defineCommand({
  meta: { name: 'topics', description: 'Manage email topics' },
  subCommands: { list, create, get, update, delete: del, 'add-contact': addContact, 'remove-contact': removeContact, 'list-contacts': listContacts },
})
